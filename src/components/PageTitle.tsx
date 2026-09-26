const SITE = 'D.A.W.N. Team'

/** Sets the document title ("Agendas · D.A.W.N. Team"). React 19 hoists <title> into <head>. */
export default function PageTitle({ title }: { title?: string }) {
  return <title>{title ? `${title} · ${SITE}` : SITE}</title>
}
