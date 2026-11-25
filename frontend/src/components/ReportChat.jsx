import React, { useEffect, useId, useRef, useState } from 'react';
import { ArrowUp, ArrowUpRight, MessageSquareText, X } from 'lucide-react';
import { askReport } from '../services/places';
import './report-chat.css';

const suggestedQuestions = [
  ['Kiram ne tutar?', 'Burada bir ev için ne kadar kira ayırmalıyım?'],
  ['İşe gidip gelmek', 'İşe gidip gelirken ulaşımda neye dikkat edeyim?'],
  ['Sosyal yaşam', 'Raporda hangi kafe ve yemek seçenekleri var?'],
  ['Güvenlik', 'Raporda güvenlikle ilgili hangi yerel gelişmeler var?'],
];

export default function ReportChat({ slug, name }) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [turns, setTurns] = useState([]);
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');
  const request = useRef(null);
  const conversation = useRef(null);
  const launcher = useRef(null);
  const heading = useRef(null);

  useEffect(() => () => request.current?.abort(), []);

  useEffect(() => {
    if (open) heading.current?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    const log = conversation.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [open, turns, pending]);

  function closeChat() {
    setOpen(false);
    launcher.current?.focus();
  }

  async function send(value) {
    const question = value.trim();
    if (!question || request.current) return;

    const controller = new AbortController();
    request.current = controller;
    setDraft('');
    setError('');
    setPending(question);
    try {
      const history = turns.slice(-6).map(({ question, answer }) => ({ question, answer: answer.slice(0, 900) }));
      const reply = await askReport(slug, question, history, { signal: controller.signal });
      if (!controller.signal.aborted) setTurns(current => [...current, { question, ...reply }]);
    } catch (err) {
      if (controller.signal.aborted) return;
      setDraft(question);
      setError(err instanceof TypeError ? 'Asistana bağlanılamadı. Tekrar deneyebilirsin.' : err.message);
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setPending('');
    }
  }

  return (
    <section
      className="report-chat"
      aria-label="Rapor asistanı"
      onKeyDown={event => {
        if (event.key === 'Escape' && open) closeChat();
      }}
    >
      <button
        className="report-chat-toggle"
        type="button"
        ref={launcher}
        aria-label={open ? 'Rapor asistanını kapat' : 'Rapor asistanını aç'}
        aria-expanded={open}
        aria-controls={panelId}
        title={open ? 'Rapor asistanını kapat' : 'Rapor asistanı'}
        onClick={() => setOpen(value => !value)}
      >
        {open ? <X size={25} aria-hidden="true" /> : <MessageSquareText size={25} aria-hidden="true" />}
      </button>
      <div id={panelId} className="report-chat-window" hidden={!open}>
        {open && (
          <div className="report-chat-panel">
            <header className="report-chat-header">
              <span className="report-chat-avatar" aria-hidden="true"><MessageSquareText size={19} /></span>
              <div>
                <h2 ref={heading} tabIndex={-1}>Mahalle asistanı</h2>
                <p>{name} raporu</p>
              </div>
              <button className="report-chat-close" type="button" aria-label="Sohbet penceresini kapat" onClick={closeChat}>
                <X size={20} aria-hidden="true" />
              </button>
            </header>
            <div className="report-chat-log" ref={conversation} role="log" aria-label="Rapor sohbeti">
              <div className="report-chat-answer">
                <p>{name} için ev mi bakıyorsun? Aklındaki kirayı ya da her gün nereye gideceğini söyle, birlikte bakalım.</p>
              </div>
              {turns.map((turn, index) => (
                <React.Fragment key={index}>
                  <div className="report-chat-question"><span className="sr-only">Sen: </span>{turn.question}</div>
                  <div className="report-chat-answer">
                    <p><span className="sr-only">Asistan: </span>{turn.answer}</p>
                    {turn.sources.length > 0 && (
                      <ul className="report-chat-sources" aria-label="Yanıt kaynakları">
                        {turn.sources.map(source => (
                          <li key={source.id}>
                            <a href={source.url} target="_blank" rel="noopener noreferrer">
                              [{source.id}] {source.label} <ArrowUpRight size={13} aria-hidden="true" />
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </React.Fragment>
              ))}
              {pending && (
                <>
                  <div className="report-chat-question"><span className="sr-only">Sen: </span>{pending}</div>
                  <div className="report-chat-answer report-chat-pending" role="status">
                    <span className="sr-only">Asistan yazıyor</span>
                    <span aria-hidden="true" /><span aria-hidden="true" /><span aria-hidden="true" />
                  </div>
                </>
              )}
            </div>
            <div className="report-chat-composer">
              {!turns.length && !pending && !error && (
                <div className="report-chat-prompts" role="group" aria-label="Önerilen sorular">
                  {suggestedQuestions.map(([label, question]) => (
                    <button key={label} type="button" onClick={() => send(question)}>{label}</button>
                  ))}
                </div>
              )}
              {error && (
                <div className="report-chat-retry">
                  <p className="report-chat-error" role="alert">{error}</p>
                  <button type="button" onClick={() => send(draft)}>Tekrar dene</button>
                </div>
              )}
              <form onSubmit={event => { event.preventDefault(); send(draft); }}>
                <input
                  aria-label="Rapor hakkında sorun"
                  placeholder="Mesajını yaz…"
                  maxLength={500}
                  readOnly={Boolean(pending)}
                  value={draft}
                  onChange={event => {
                    setDraft(event.target.value);
                    setError('');
                  }}
                />
                <button type="submit" aria-label="Gönder" disabled={!draft.trim() || Boolean(pending)}>
                  <ArrowUp size={20} aria-hidden="true" />
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
