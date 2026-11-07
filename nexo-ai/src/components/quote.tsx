/** Muestra el mensaje completo resaltando el fragmento citado (si se encuentra literal). */
export function HighlightedQuote({ body, quote }: { body: string; quote: string | null }) {
  const q = (quote ?? "").replace(/^…|…$/g, "").trim();
  const i = q.length >= 3 ? body.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i < 0) return <>{body}</>;
  return (
    <>
      {body.slice(0, i)}
      <mark className="hit">{body.slice(i, i + q.length)}</mark>
      {body.slice(i + q.length)}
    </>
  );
}
