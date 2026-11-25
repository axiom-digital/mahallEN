import React, { useMemo, useState } from 'react';
import { budgetScore, normalizeScoreValue } from '../scoring.mjs';
import ReportChat from './ReportChat';
import NeighborhoodGuide from './report/NeighborhoodGuide';
import ScoreOverview from './report/ScoreOverview';
import ReportNarrative from './report/ReportNarrative';
import ReportMethod from './report/ReportMethod';
import CategoryEvidence from './report/CategoryEvidence';
import { CATEGORIES, currency } from './report/reportDetails';

export default function AssessedReport({ report, onReloadReport, refreshing }) {
  const [activeCategory, setActiveCategory] = useState(null);
  const [chartMode, setChartMode] = useState('bars');
  const [room, setRoom] = useState('1+1');
  const [personalBudgetInput, setPersonalBudgetInput] = useState('');
  const [venueKind, setVenueKind] = useState('Tümü');
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [showAllFindings, setShowAllFindings] = useState(false);
  const [profile, setProfile] = useState('students');
  const [copiedLink, setCopiedLink] = useState(false);

  const assessment = report.assessment;
  const calculation = assessment.calculation || {};
  const briefing = assessment.briefing || {};
  const roomGroups = briefing.rent_types || [];
  const roomGroup = roomGroups.find((group) => group.rooms === room) || roomGroups[0];
  const venues = useMemo(
    () => (briefing.venues || []).filter((venue) => venueKind === 'Tümü' || venue.kind === venueKind),
    [briefing.venues, venueKind]
  );
  const counts = calculation.counts || {};
  const evidence = report.evidence_report;
  const narrative = report.ai_report || {};
  const paragraphs = (narrative.executive_summary || '').split(/\n+/).filter(Boolean);
  const selectedCategoryDef = CATEGORIES.find((c) => c.key === activeCategory);
  const findings = evidence.categories.find((c) => c.id === activeCategory)?.items || [];
  const archivedNews =
    evidence.categories.find((c) => c.id === 'safety_news')?.historical_items || [];
  const rationale = (key) => assessment.categories.find((c) => c.category === key)?.rationale;
  const date = new Date(`${evidence.reference_date}T12:00:00`).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Personal budget check (client-side helper using scoring.mjs without altering backend scores)
  const parsedBudget = Number(personalBudgetInput);
  const validBudget =
    personalBudgetInput.trim() !== '' &&
    Number.isFinite(parsedBudget) &&
    parsedBudget >= 1000 &&
    parsedBudget <= 1000000
      ? parsedBudget
      : null;

  const activeRoomMedian = useMemo(() => {
    if (!roomGroup) return null;
    if (Number.isFinite(roomGroup.median) && roomGroup.median > 0) return roomGroup.median;
    const amounts = (roomGroup.listings || [])
      .map((l) => l.amount)
      .filter((a) => Number.isFinite(a) && a > 0)
      .sort((a, b) => a - b);
    if (!amounts.length) return null;
    const mid = Math.floor(amounts.length / 2);
    return amounts.length % 2 ? amounts[mid] : (amounts[mid - 1] + amounts[mid]) / 2;
  }, [roomGroup]);

  const personalFitScore =
    validBudget && activeRoomMedian ? budgetScore(activeRoomMedian, validBudget) : null;

  const roomPriceExtents = useMemo(() => {
    const amounts = (roomGroup?.listings || [])
      .map((item) => item.amount)
      .filter((a) => Number.isFinite(a) && a > 0);
    if (!amounts.length) return null;
    return {
      min: roomGroup.min ?? Math.min(...amounts),
      median: activeRoomMedian,
      max: roomGroup.max ?? Math.max(...amounts),
    };
  }, [roomGroup, activeRoomMedian]);

  function openCategory(key) {
    setActiveCategory(key);
    setShowAllFindings(false);
  }

  async function handleShareLink() {
    const shareUrl = window.location.href;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const input = document.createElement('input');
        input.value = shareUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      setCopiedLink(false);
    }
  }

  const profileOptions = [
    { key: 'students', label: 'Öğrenci', verdictKey: 'student_verdict' },
    { key: 'families', label: 'Aile', verdictKey: 'family_verdict' },
    { key: 'professionals', label: 'Çalışan', verdictKey: 'professional_verdict' },
  ];

  const activeCategoryScore = selectedCategoryDef
    ? normalizeScoreValue(report.scores?.[selectedCategoryDef.score])
    : null;
  const activeCategoryMeta = selectedCategoryDef
    ? report.category_meta?.[selectedCategoryDef.score]
    : null;

  return (
    <div className="space-y-6" data-testid="report-dashboard">
      {/* TOP REPORT HEADER & ACTION BAR */}
      {report.evidence_report?.refresh_status === 'previous_report' ? (
        <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          Güncelleme tamamlanamadı. {date} tarihli kayıtlı raporu görüyorsun. Puanlar ve kaynaklar o tarihe ait.
        </p>
      ) : report.evidence_report?.assessment_mode === 'source_summary' && (
        <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          Araştırmanın bazı adımları geçici olarak tamamlanamadı. Burada kaynaklardan hesaplanan puanlar ve eldeki bulgular gösteriliyor. Beş dakika sonra tam raporu yeniden açabilirsin.
        </p>
      )}
      <NeighborhoodGuide report={report} date={date} openCategory={openCategory}
        handleShareLink={handleShareLink} copiedLink={copiedLink} onReloadReport={onReloadReport} refreshing={refreshing} />
      <details className="guide-fold"><summary>🧭 Mahalle yorumu ve yaşam profilleri</summary><div>
      <ReportNarrative
        report={report}
        paragraphs={paragraphs}
        narrative={narrative}
        profileOptions={profileOptions}
        profile={profile}
        setProfile={setProfile}
      />

      </div></details>
      <details className="guide-fold"><summary>📊 Puanların ayrıntısı</summary><div>
      <ScoreOverview
        report={report}
        assessment={assessment}
        chartMode={chartMode}
        setChartMode={setChartMode}
        openCategory={openCategory}
      />

      </div></details>

      {/* PRINT-ONLY EXECUTIVE APPENDIX (for clean PDF exports without interactive drawer) */}
      <section className="print-only rounded-xl border border-slate-300 p-4">
        <h3 className="text-sm font-semibold text-slate-900">Özet Ölçüm ve Kayıt Notları</h3>
        <div className="mt-2 grid grid-cols-2 gap-3 text-xs text-slate-700">
          <div>
            <strong>Kira Özeti:</strong> {report.rent_analysis?.rent_range_tl || 'İlan kaydı sınırlı'}{' '}
            {report.rent_analysis?.average_rent_tl != null
              ? `· Medyan: ${currency(report.rent_analysis.average_rent_tl)}`
              : ''}
          </div>
          <div>
            <strong>Deprem (PGA):</strong>{' '}
            {briefing.hazard?.value != null ? `${briefing.hazard.value} g` : 'Grid kaydı yok'}
          </div>
          <div>
            <strong>Ulaşım Hatları:</strong>{' '}
            {briefing.routes?.map((r) => r.code || r.route).join(', ') || 'Hat kaydı yok'}
          </div>
          <div>
            <strong>Örnek Mekân Sayısı:</strong> {briefing.venues?.length || 0}
          </div>
        </div>
      </section>

      {/* BENTO ROW 4: TRANSPARENCY, METHODOLOGY & SOURCES */}
      <ReportMethod
        assessment={assessment}
        date={date}
        openCategory={openCategory}
        rationale={rationale}
        report={report}
        evidence={evidence}
      />

      <p className="text-center text-xs text-slate-500">
        Puanlar kaynaklı proje göstergeleridir. Ev seçerken kaynağın tarihini ve evin kendi koşullarını birlikte değerlendir.
      </p>

      <ReportChat key={report.slug} slug={report.slug} name={report.name} />

      {/* RIGHT SLIDE-OVER CATEGORY DRAWER */}
      <CategoryEvidence
        selectedCategoryDef={selectedCategoryDef}
        report={report}
        setActiveCategory={setActiveCategory}
        activeCategoryScore={activeCategoryScore}
        activeCategoryMeta={activeCategoryMeta}
        assessment={assessment}
        activeCategory={activeCategory}
        openCategory={openCategory}
        roomGroups={roomGroups}
        briefing={briefing}
        setRoom={setRoom}
        roomGroup={roomGroup}
        roomPriceExtents={roomPriceExtents}
        validBudget={validBudget}
        activeRoomMedian={activeRoomMedian}
        personalBudgetInput={personalBudgetInput}
        setPersonalBudgetInput={setPersonalBudgetInput}
        personalFitScore={personalFitScore}
        setVenueKind={setVenueKind}
        setSelectedVenue={setSelectedVenue}
        setShowAllFindings={setShowAllFindings}
        venueKind={venueKind}
        venues={venues}
        selectedVenue={selectedVenue}
        showAllFindings={showAllFindings}
        findings={findings}
        archivedNews={archivedNews}
        rationale={rationale}
      />
    </div>
  );
}
