import React, { useEffect, useState } from 'react';
import { ArrowUpRight, MapPin, Search, X } from 'lucide-react';
import { suggestPlaces } from '../services/places';

export default function PlaceSearch({ input, onInput, onSubmit, onSelect }) {
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    const query = input.trim();
    if (!focused || query.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const { results } = await suggestPlaces(query, controller.signal);
        if (!controller.signal.aborted) setSuggestions(results);
      } catch {
        if (!controller.signal.aborted) setSuggestions([]);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [input, focused]);

  const expanded = focused && suggestions.length > 0;

  function select(place) {
    setFocused(false);
    setActive(-1);
    onSelect(place);
  }

  function handleKeys(event) {
    if (event.key === 'Escape') {
      setFocused(false);
      setActive(-1);
      return;
    }
    if (!expanded) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((index) => {
        if (index === -1) return step === 1 ? 0 : suggestions.length - 1;
        return (index + step + suggestions.length) % suggestions.length;
      });
    }
    if (event.key === 'Enter' && suggestions[active]) {
      event.preventDefault();
      select(suggestions[active]);
    }
  }

  function changeInput(value) {
    setSuggestions([]);
    setActive(-1);
    setFocused(true);
    onInput(value);
  }

  return (
    <form
      id="hero-search"
      className="place-search"
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        setFocused(false);
        setActive(-1);
        onSubmit();
      }}
      onBlur={(event) => {
        if (event.currentTarget.contains(event.relatedTarget)) return;
        setFocused(false);
        setActive(-1);
      }}
    >
      <div className="search-field">
        <Search size={18} aria-hidden="true" />
        <label className="sr-only" htmlFor="neighborhood-search">Mahalle ara</label>
        <input
          id="neighborhood-search"
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-controls={expanded ? 'neighborhood-suggestions' : undefined}
          aria-expanded={expanded}
          aria-activedescendant={expanded && active >= 0 ? `suggestion-${active}` : undefined}
          autoComplete="off"
          maxLength={100}
          value={input}
          placeholder="Mahalle veya ilçe ara…"
          onChange={(event) => changeInput(event.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={handleKeys}
        />
        {input && (
          <button type="button" aria-label="Aramayı temizle" className="clear-search" onClick={() => changeInput('')}>
            <X size={16} aria-hidden="true" />
          </button>
        )}
        <button type="submit" className="search-submit">Keşfet <ArrowUpRight size={15} aria-hidden="true" /></button>
      </div>
      {expanded && (
        <ul id="neighborhood-suggestions" className="search-suggestions" role="listbox" aria-label="Mahalle önerileri">
          {suggestions.map((place, index) => (
            <li
              id={`suggestion-${index}`}
              key={place.id}
              role="option"
              aria-selected={index === active}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => select(place)}
            >
              <MapPin size={15} aria-hidden="true" />
              <span><strong>{place.name}</strong><small>{place.district} / {place.city}</small></span>
              <small>{place.report_available ? 'Rapor hazır' : 'Raporu aç ↗'}</small>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
