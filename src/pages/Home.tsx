import Hero from '../components/home/Hero'
import LatestFourUpCard from '../components/home/LatestFourUpCard'
import NextMeetingCard from '../components/home/NextMeetingCard'
import QuickLinks from '../components/home/QuickLinks'
import RecentlyPublished from '../components/home/RecentlyPublished'
import TeamStrip from '../components/home/TeamStrip'
import { isSourceConfigured } from '../config/sources'
import { useMeetings, usePublishedCategories } from '../lib/drive'
import { ABOUT, CURRENT_STATE } from '../../CONTENT'
import PageTitle from '../components/PageTitle'

// Sources without a folder ID are hidden rather than shown as errors.
const SHOW_AGENDAS = isSourceConfigured('agendas')
const SHOW_FOUR_UPS = isSourceConfigured('fourUps')
const SHOW_PUBLISHED = isSourceConfigured('publishedArtifacts')

export default function Home() {
  const meetings = useMeetings()
  const published = usePublishedCategories()

  return (
    <>
      <PageTitle />
      <Hero />
      <div className="mx-auto max-w-5xl space-y-20 px-6 py-16 sm:py-20">
        {(SHOW_AGENDAS || SHOW_FOUR_UPS) && (
          <div className="grid gap-6 md:grid-cols-2">
            {SHOW_AGENDAS && <NextMeetingCard meetings={meetings} />}
            {SHOW_FOUR_UPS && <LatestFourUpCard meetings={meetings} />}
          </div>
        )}
        <section id="about" aria-labelledby="about-title">
          <h2 id="about-title" className="text-2xl font-semibold">
            About D.A.W.N.
          </h2>
          {/* TODO: replace with the real project overview. */}
          {ABOUT.split('\n').map((line, i) => (
            <p key={i} className="mt-4 max-w-prose text-dusk">
              {line}
            </p>
          ))}
          {CURRENT_STATE && <p className="mt-4 max-w-prose text-dusk">{CURRENT_STATE}</p>}
        </section>
        {SHOW_PUBLISHED && <RecentlyPublished categories={published} />}
        <QuickLinks />
        <TeamStrip />
      </div>
    </>
  )
}
