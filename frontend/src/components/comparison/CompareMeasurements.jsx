import React from 'react';
import { Activity } from 'lucide-react';

export default function CompareMeasurements({
  data1,
  data2,
  getEvidenceCount,
}) {
  return (
    <section className="grid gap-5 lg:grid-cols-12">
      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card lg:col-span-6">
        <div className="mb-4 flex items-center gap-2">
          <Activity size={17} className="text-slate-500" />
          <h2 className="text-base font-semibold text-slate-900">
            Somut Ölçüm ve Kayıtlar
          </h2>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-3.5 py-2.5 font-medium">Ölçüt</th>
                <th className="px-3.5 py-2.5 font-semibold text-emerald-700">{data1.name}</th>
                <th className="px-3.5 py-2.5 font-semibold text-blue-700">{data2.name}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="px-3.5 py-2.5 text-slate-600">Deprem Tehlikesi (PGA)</td>
                <td className="px-3.5 py-2.5 font-mono font-semibold text-slate-900">
                  {data1.disaster_risk?.pga_value_g != null
                    ? `${data1.disaster_risk.pga_value_g} g`
                    : 'Ölçüm yok'}
                </td>
                <td className="px-3.5 py-2.5 font-mono font-semibold text-slate-900">
                  {data2.disaster_risk?.pga_value_g != null
                    ? `${data2.disaster_risk.pga_value_g} g`
                    : 'Ölçüm yok'}
                </td>
              </tr>
              <tr>
                <td className="px-3.5 py-2.5 text-slate-600">1+1 Eşdeğer Medyan</td>
                <td className="px-3.5 py-2.5 font-mono font-semibold text-slate-900">
                  {data1.rent_analysis?.average_rent_tl != null
                    ? `${Number(data1.rent_analysis.average_rent_tl).toLocaleString('tr-TR')} TL`
                    : '—'}
                </td>
                <td className="px-3.5 py-2.5 font-mono font-semibold text-slate-900">
                  {data2.rent_analysis?.average_rent_tl != null
                    ? `${Number(data2.rent_analysis.average_rent_tl).toLocaleString('tr-TR')} TL`
                    : '—'}
                </td>
              </tr>
              <tr>
                <td className="px-3.5 py-2.5 text-slate-600">Kira İlan Örnekleri</td>
                <td className="px-3.5 py-2.5 font-mono text-slate-800">
                  {getEvidenceCount(data1, 'rent_cost')} kayıt
                </td>
                <td className="px-3.5 py-2.5 font-mono text-slate-800">
                  {getEvidenceCount(data2, 'rent_cost')} kayıt
                </td>
              </tr>
              <tr>
                <td className="px-3.5 py-2.5 text-slate-600">Ulaşım Kayıtları</td>
                <td className="px-3.5 py-2.5 font-mono text-slate-800">
                  {getEvidenceCount(data1, 'transportation')} hat/durak
                </td>
                <td className="px-3.5 py-2.5 font-mono text-slate-800">
                  {getEvidenceCount(data2, 'transportation')} hat/durak
                </td>
              </tr>
              <tr>
                <td className="px-3.5 py-2.5 text-slate-600">Sosyal Yaşam Kayıtları</td>
                <td className="px-3.5 py-2.5 font-mono text-slate-800">
                  {getEvidenceCount(data1, 'social_life')} mekân
                </td>
                <td className="px-3.5 py-2.5 font-mono text-slate-800">
                  {getEvidenceCount(data2, 'social_life')} mekân
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      {/* Transport Highlights */}
      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card lg:col-span-6">
        <h2 className="mb-4 text-base font-semibold text-slate-900">Ulaşım Vurguları</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { data: data1, tone: 'text-emerald-700 border-emerald-200 bg-emerald-50/40' },
            { data: data2, tone: 'text-blue-700 border-blue-200 bg-blue-50/40' },
          ].map(({ data, tone }, colIdx) => (
            <div key={colIdx} className={`rounded-xl border p-3.5 ${tone}`}>
              <strong className="block text-xs font-semibold">{data.name}</strong>
              {data.transport_analysis?.highlights?.length > 0 ? (
                <ul className="mt-2 space-y-1.5 text-xs text-slate-700">
                  {data.transport_analysis.highlights.slice(0, 4).map((h, i) => (
                    <li key={i} className="leading-relaxed">
                      • {h}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-slate-500">Kayıtlı ulaşım hattı bulunamadı.</p>
              )}
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
