import { useEffect, useRef, useState } from 'react';
import { adaptPlaceReport } from '../../services/placeAdapter.mjs';
import { getPlace, openPlaceReport, suggestPlaces } from '../../services/places';
import { pilotPlaces, placeQuery, samePlace } from '../../station/pilotPlaces';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export const PHASE_LABELS = {
  checking: 'Önbellek kontrol ediliyor…',
  research: 'Kaynaklar taranıyor…',
  extraction: 'Bulgular ayrıştırılıyor…',
  writing: 'Rapor hazırlanıyor…',
  ready: 'Tamamlandı',
};

export function selectionFromParam(rawValue, fallbackSlug) {
  const val = (rawValue || '').trim();
  if (!val) {
    return pilotPlaces.find((p) => p.slug === fallbackSlug) || pilotPlaces[0];
  }
  const pilotMatch = pilotPlaces.find((p) => p.slug === val.toLowerCase());
  if (pilotMatch) return pilotMatch;
  if (/^[a-f0-9]{32}$/i.test(val)) {
    return { kind: 'place', id: val.toLowerCase(), name: 'Seçili mahalle', district: '', city: '' };
  }
  return pilotPlaces.find((p) => p.slug === fallbackSlug) || pilotPlaces[0];
}

export function sameSelection(a, b) {
  if (!a || !b) return false;
  if (a.kind === 'pilot' && b.kind === 'pilot') return a.slug === b.slug;
  if (a.kind === 'place' && b.kind === 'place') return a.id === b.id;
  return false;
}

async function fetchCachedOrPilotReport(selection, signal) {
  if (selection.kind === 'place') {
    const meta = await getPlace(selection.id, signal);
    const res = await fetch(`${API_BASE}/places/${encodeURIComponent(selection.id)}/report`, {
      signal,
    });
    if (res.status === 404) {
      return { status: 'needs-prepare', place: meta, data: null };
    }
    if (!res.ok) {
      throw new Error('Mahalle raporu alınamadı.');
    }
    const raw = await res.json();
    const adapted = adaptPlaceReport(raw);
    return { status: 'ready', place: meta, data: { ...adapted, placeId: selection.id } };
  }

  // Pilot selection
  const target = pilotPlaces.find((n) => n.slug === selection.slug);
  let placeId = null;

  if (target) {
    try {
      const suggestionRes = await suggestPlaces(
        placeQuery(target),
        signal
      );
      const matched = (suggestionRes?.results || []).find(
        (place) => samePlace(place, target)
      );
      if (matched?.id) {
        placeId = matched.id;
        const placeReportRes = await fetch(
          `${API_BASE}/places/${encodeURIComponent(placeId)}/report`,
          { signal }
        );
        if (placeReportRes.ok) {
          const rawPlaceReport = await placeReportRes.json();
          const adapted = adaptPlaceReport(rawPlaceReport);
          return { status: 'ready', place: matched, data: { ...adapted, placeId } };
        }
      }
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
    }
  }

  const pilotRes = await fetch(
    `${API_BASE}/neighborhoods/${encodeURIComponent(selection.slug)}/report`,
    { signal }
  );
  if (!pilotRes.ok) {
    throw new Error('Mahalle verisi alınamadı.');
  }
  const pilotJson = await pilotRes.json();
  return { status: 'ready', place: target || null, data: { ...pilotJson, placeId } };
}

export function useComparisonSlot(selection) {
  const [state, setState] = useState({
    loading: true,
    preparing: false,
    phase: 'checking',
    status: 'loading',
    place: null,
    data: null,
    error: null,
  });
  const prepareAbortRef = useRef(null);

  useEffect(() => {
    prepareAbortRef.current?.abort();
    const controller = new AbortController();
    setState({
      loading: true,
      preparing: false,
      phase: 'checking',
      status: 'loading',
      place: null,
      data: null,
      error: null,
    });

    fetchCachedOrPilotReport(selection, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setState({
          loading: false,
          preparing: false,
          phase: result.status === 'ready' ? 'ready' : 'checking',
          status: result.status,
          place: result.place,
          data: result.data,
          error: null,
        });
      })
      .catch((err) => {
        if (err?.name === 'AbortError' || controller.signal.aborted) return;
        setState({
          loading: false,
          preparing: false,
          phase: 'checking',
          status: 'error',
          place: null,
          data: null,
          error: err.message || 'Mahalle verisi alınamadı.',
        });
      });

    return () => controller.abort();
  }, [selection]);

  const startLivePrepare = () => {
    if (selection.kind !== 'place') return;
    prepareAbortRef.current?.abort();
    const controller = new AbortController();
    prepareAbortRef.current = controller;

    setState((prev) => ({
      ...prev,
      preparing: true,
      phase: 'research',
      error: null,
    }));

    openPlaceReport(
      selection.id,
      controller.signal,
      () => {},
      (nextPhase) => {
        if (!controller.signal.aborted) {
          setState((prev) => ({ ...prev, phase: nextPhase }));
        }
      }
    )
      .then((res) => {
        if (controller.signal.aborted) return;
        const adapted = adaptPlaceReport(res.data);
        setState((prev) => ({
          ...prev,
          loading: false,
          preparing: false,
          phase: 'ready',
          status: 'ready',
          data: { ...adapted, placeId: selection.id },
          error: null,
        }));
      })
      .catch((err) => {
        if (err?.name === 'AbortError' || controller.signal.aborted) return;
        setState((prev) => ({
          ...prev,
          preparing: false,
          status: 'needs-prepare',
          error: err.message || 'Canlı rapor hazırlanamadı.',
        }));
      });
  };

  return { state, startLivePrepare };
}
