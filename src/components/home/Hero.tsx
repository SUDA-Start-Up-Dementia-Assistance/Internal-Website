import { ArrowRight } from 'lucide-react'
import heroPhoto from '../../assets/hero.png'
import SunArc from '../SunArc'
import Foliage from './Foliage'
import Hills from './Hills'

/**
 * Uses bg-dawn-deep rather than bg-dawn: cream text fails AA on lavender/apricot (~3:1),
 * so the hero's sky is built from dusk and ember instead. Ratios were checked against
 * rendered pixels.
 */
export default function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative isolate overflow-hidden bg-dawn-deep text-cream on-night"
    >
      <Hills className="absolute inset-x-0 bottom-0 -z-10 h-[20%] min-h-24" />
      <Foliage className="absolute right-0 bottom-0 -z-10 h-28 w-auto opacity-40 blur-[1.5px] lg:h-[32%]" />

      <div className="mx-auto grid max-w-[1400px] items-center gap-10 px-6 pt-12 pb-16 lg:min-h-[560px] lg:grid-cols-[minmax(0,48fr)_minmax(0,52fr)] lg:gap-12 lg:px-10 lg:py-10">
        <div className="lg:order-2">
          <div aria-hidden="true" className="-ml-3 w-40 overflow-hidden sm:w-48">
            <SunArc className="block w-full motion-safe:animate-sun-rise" />
          </div>
          <p className="font-heading text-5xl leading-none font-semibold tracking-tight sm:text-6xl">
            D.A.W.N.
          </p>
          <p className="mt-2 font-heading text-lg sm:text-xl">
            Daily Awareness &amp; Well-being Navigator
          </p>
          <h1
            id="hero-title"
            className="mt-4 text-4xl leading-tight font-medium text-balance sm:text-5xl lg:text-[2.5rem]"
          >
            A familiar place to begin each day.
          </h1>
          <p className="mt-3 max-w-prose text-lg leading-normal text-cream">
            D.A.W.N. is a tablet-based experience designed to help people living with dementia feel
            more oriented, engaged, and connected. Through a simple, personalized interface, it
            brings together daily information, meaningful content, and the people they love in one
            reassuring place.
          </p>
          <a
            href="#about"
            className="mt-7 inline-flex items-center gap-2 rounded-full border border-gold bg-night px-7 py-2.5 font-heading text-lg text-cream shadow-glow transition-shadow hover:shadow-glow-strong focus-visible:shadow-glow-strong"
          >
            Learn More
            <ArrowRight aria-hidden="true" className="size-5" />
          </a>
        </div>

        <div className="relative z-0 hidden lg:order-1 lg:block">
          <img
            src={heroPhoto}
            alt="An older woman and a younger woman smile together on a sofa, looking at a tablet in a sunlit living room."
            width={620}
            height={459}
            className="aspect-[4/3] w-full rounded-2xl object-cover shadow-photo"
          />
        </div>
      </div>
    </section>
  )
}
