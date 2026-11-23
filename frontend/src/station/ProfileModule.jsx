import React, { useState } from 'react';
import { Activity, Bus, ShieldCheck, Users, Wallet } from 'lucide-react';
import { profiles } from '../scoring.mjs';

const channels = [
  { key: 'rent', label: 'Kira', title: 'Maliyet & Kira', Icon: Wallet },
  { key: 'social', label: 'Yaşam', title: 'Sosyal Yaşam', Icon: Users },
  { key: 'news', label: 'Gündem', title: 'Yerel Gündem', Icon: ShieldCheck },
  { key: 'transport', label: 'Ulaşım', title: 'Ulaşım', Icon: Bus },
  { key: 'hazard', label: 'Deprem', title: 'Deprem Verisi', Icon: Activity },
];

export default function ProfileModule({ profile, onProfile }) {
  const [selectedChannel, setChannel] = useState(0);
  const { label, weights } = profiles[profile];
  const { key, title, Icon } = channels[selectedChannel];

  return (
    <div className="device-stage">
      <section className="device" aria-label="Yaşam profili ve ölçüt ağırlıkları">
        <div className="device-rail">
          <b>MahallEN.</b><span>Profil modülü</span>
        </div>
        <div className="instrument-display" aria-live="polite">
          <div className="display-info">
            <span>{label} profil</span>
            <Icon size={30} aria-hidden="true" />
            <b>{title}</b>
            <small>Puan ağırlığı</small>
          </div>
          <div className="readout" key={profile + key}><small>%</small>{weights[key]}</div>
        </div>
        <div className="channels" role="group" aria-label="Ölçüt seçimi">
          {channels.map((channel, index) => (
            <button
              key={channel.key}
              type="button"
              className="channel"
              aria-pressed={selectedChannel === index}
              onClick={() => setChannel(index)}
            >
              <span className="dial" aria-hidden="true" style={{ '--turn': `${-112 + weights[channel.key] * 6}deg` }} />
              <span>{channel.label}</span>
            </button>
          ))}
        </div>
        <div className="mode-row" role="group" aria-label="Yaşam profili">
          {Object.entries(profiles).map(([key, item]) => (
            <button type="button" key={key} aria-pressed={profile === key} onClick={() => onProfile(key)}>
              {item.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
