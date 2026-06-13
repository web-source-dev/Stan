import Link from 'next/link';
import { Reveal } from '@/components/Reveal';
import { HeroCluster } from '@/components/landing/HeroCluster';

/* ------------------------------------------------------------------ */
/* Data (real creators featured on stan.store)                         */
/* ------------------------------------------------------------------ */

const CREATORS = [
  {
    name: 'Abigail Peugh',
    handle: '@abigailpeugh',
    social: '/stan/ic-tiktok.svg',
    followers: '100K+ Followers',
    emoji: '💰',
    tag: 'Business Coach',
    img: '/stan/abi.png',
    store: '/stan/store-abi.png',
    href: 'https://stan.store/abigailpeugh',
  },
  {
    name: 'Millie Adrian',
    handle: '@itsmodernmillie',
    social: '/stan/ic-instagram.svg',
    followers: '150K+ Followers',
    emoji: '📲',
    tag: 'Social Media Coach',
    img: '/stan/millie.jpg',
    store: '/stan/store-millie.png',
    href: 'https://stan.store/itsmodernmillie',
  },
  {
    name: 'Eddie Abbew',
    handle: '@eddieabbew',
    social: '/stan/ic-instagram.svg',
    followers: '554K+ Followers',
    emoji: '💪',
    tag: 'Fitness Coach',
    img: '/stan/eddie.png',
    store: '/stan/store-eddie.svg',
    href: 'https://stan.store/eddieabbew',
  },
  {
    name: 'Sarah Perl',
    handle: '@hothighpriestess',
    social: '/stan/ic-tiktok.svg',
    followers: '2.4M+ Followers',
    emoji: '✨',
    tag: 'Spirituality Creator',
    img: '/stan/priest.png',
    store: '/stan/store-priestess.png',
    href: 'https://stan.store/hothighpriestess',
  },
  {
    name: 'Tatiana Londono',
    handle: '@tatlondono',
    social: '/stan/ic-tiktok.svg',
    followers: '2.8M+ Followers',
    emoji: '🏠',
    tag: 'Real Estate Coach',
    img: '/stan/tat.jpg',
    store: '/stan/store-tat.png',
    href: 'https://www.tiktok.com/@tatlondono',
  },
];

const TESTIMONIAL_COLUMNS = [
  ['/stan/t-abigail.png', '/stan/t-3.png', '/stan/t-2.png'],
  ['/stan/t-jenna.png', '/stan/t-5.png', '/stan/t-7.png'],
  ['/stan/t-10.png', '/stan/t-8.png', '/stan/t-9.png'],
];

const SOCIALS = [
  { src: '/stan/social-youtube.svg', alt: 'YouTube', href: 'https://www.youtube.com/channel/UCQ1wox_PP5Lds__fQdy6NvQ' },
  { src: '/stan/social-twitter.svg', alt: 'Twitter', href: 'https://twitter.com/stanforcreators' },
  { src: '/stan/social-instagram.svg', alt: 'Instagram', href: 'https://www.instagram.com/stanforcreators' },
  { src: '/stan/social-tiktok.svg', alt: 'TikTok', href: 'https://www.tiktok.com/@stanforcreators' },
  { src: '/stan/social-linkedin.svg', alt: 'LinkedIn', href: 'https://www.linkedin.com/company/stanwithme' },
];

const FOOTER_LINKS = [
  { label: 'Sign In', href: '/login' },
  { label: 'Blog', href: 'https://stan.store/blog' },
  { label: 'Referral Program', href: 'https://help.stan.store/article/89-referral-program-overview' },
  { label: 'Jobs', href: 'https://careers.kula.ai/stan' },
  { label: 'Help', href: 'https://help.stan.store/' },
  { label: 'Privacy Policy', href: 'https://assets.stanwith.me/legal/privacy-policy.pdf' },
  { label: 'Terms and Conditions', href: 'https://assets.stanwith.me/legal/terms-of-service.pdf' },
];

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function LandingPage() {
  return (
    <div className="overflow-x-hidden font-['Plus_Jakarta_Sans'] text-[#131f60]">
      {/* ============================== HERO ============================== */}
      <section className="relative overflow-hidden bg-[#6355ff] pb-24 sm:pb-28">
        {/* Nav */}
        <header className="relative z-30">
          <div className="mx-auto flex max-w-[1180px] items-center justify-between px-5 py-5">
            <div className="flex items-center gap-8">
              <Link href="/" aria-label="Stan Logo">
                <img src="/stan/logo.svg" alt="Stan" className="h-7 w-auto brightness-0 invert" />
              </Link>
              <nav className="hidden items-center gap-7 text-[15px] font-semibold text-white md:flex">
                <Link href="/" className="opacity-100 hover:opacity-80">Home</Link>
                <a href="#" className="opacity-70 hover:opacity-100">Our Mission</a>
                <a href="#" className="opacity-70 hover:opacity-100">Blog</a>
              </nav>
            </div>

            {/* desktop auth */}
            <div className="hidden items-center gap-6 md:flex">
              <Link href="/login" className="text-[15px] font-semibold text-white hover:opacity-80">Log in</Link>
              <Link href="/signup" className="text-[15px] font-semibold text-white hover:opacity-80">Sign Up</Link>
            </div>

            {/* mobile menu (CSS-only via peer checkbox) */}
            <div className="md:hidden">
              <input id="navtoggle" type="checkbox" className="peer hidden" />
              <label htmlFor="navtoggle" className="flex h-10 w-10 cursor-pointer flex-col items-center justify-center gap-[5px]" aria-label="Toggle Nav">
                <span className="h-0.5 w-6 rounded bg-white" />
                <span className="h-0.5 w-6 rounded bg-white" />
                <span className="h-0.5 w-6 rounded bg-white" />
              </label>
              <div className="absolute left-0 right-0 top-full z-30 hidden flex-col gap-1 bg-[#5a4cf0] px-5 py-4 text-white peer-checked:flex">
                <Link href="/" className="py-2 font-semibold">Home</Link>
                <a href="#" className="py-2 font-semibold opacity-80">Our Mission</a>
                <a href="#" className="py-2 font-semibold opacity-80">Blog</a>
                <Link href="/login" className="py-2 font-semibold">Log in</Link>
                <Link href="/signup" className="py-2 font-semibold">Sign Up</Link>
              </div>
            </div>
          </div>
        </header>

        {/* Hero content */}
        <div className="mx-auto grid max-w-[1180px] items-center gap-6 px-5 pt-6 lg:grid-cols-[0.9fr_1.1fr] lg:pt-10">
          <div className="animate-slide-up text-center text-white lg:text-left">
            <h1 className="font-['Grobek'] text-[2.7rem] font-bold leading-[1.02] tracking-tight sm:text-[3.4rem] lg:text-[4rem]">
              Meet Your All·in·One Creator Store
            </h1>
            <p className="mx-auto mt-6 max-w-md text-[17px] leading-relaxed text-white/85 lg:mx-0">
              Stan is the <i>easiest</i> way to make money online. All of your courses, digital
              products, and bookings are now hosted within your link-in-bio.
            </p>
            <div className="mt-9 flex justify-center lg:justify-start">
              <Link
                href="/signup"
                className="group inline-flex items-center gap-3 rounded-full bg-[#5affb4] px-8 py-4 text-[17px] font-bold text-[#131f60] shadow-[0_14px_34px_-8px_rgba(90,255,180,0.6)] transition hover:brightness-105"
              >
                Continue
                <img src="/stan/arrow.svg" alt="" className="h-4 w-auto transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>

          <HeroCluster />
        </div>
      </section>

      {/* ===================== BEST CREATORS CAROUSEL ===================== */}
      <section className="bg-white py-16 sm:py-20">
        <Reveal className="mx-auto max-w-2xl px-5 text-center">
          <h2 className="font-['Grobek'] text-[1.9rem] font-bold tracking-tight sm:text-[2.4rem]">
            The Best Creators Use Stan 🚀
          </h2>
          <p className="mt-3 text-[15px] text-[#131f60]/60">
            See how our creators use Stan to superpower their businesses!
          </p>
        </Reveal>

        <div className="no-scrollbar mt-12 flex gap-6 overflow-x-auto px-5 pb-4 sm:px-[max(1.25rem,calc((100vw-1180px)/2))]">
          {CREATORS.map((c) => (
            <CreatorHighlight key={c.name} {...c} />
          ))}
        </div>
      </section>

      {/* ===================== TESTIMONIAL WALL ====================== */}
      <section className="bg-[#f2f1ff] py-20">
        <Reveal className="mx-auto max-w-2xl px-5 text-center">
          <h2 className="font-['Grobek'] text-[1.9rem] font-bold tracking-tight sm:text-[2.4rem]">
            See What People Are Saying 👀
          </h2>
          <p className="mt-3 text-[15px] text-[#131f60]/60">
            Stan is the easiest way to start selling online.
          </p>
        </Reveal>

        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-1 gap-4 px-5 sm:grid-cols-2 lg:grid-cols-3">
          {TESTIMONIAL_COLUMNS.map((col, ci) => (
            <div key={ci} className="flex flex-col gap-4">
              {col.map((src, ri) => (
                <Reveal key={src} delay={(ci * 3 + ri) * 50}>
                  <img
                    src={src}
                    alt="Customer testimonial"
                    loading="lazy"
                    className="w-full rounded-2xl shadow-[0_10px_30px_-12px_rgba(20,12,60,0.25)]"
                  />
                </Reveal>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ========================= 0% FEES ============================== */}
      <section className="bg-white py-24">
        <Reveal className="flex flex-col items-center justify-center gap-5 sm:flex-row">
          <div className="relative grid h-[160px] w-[190px] place-items-center">
            <svg width="190" height="160" viewBox="0 0 335 282" fill="none" className="absolute inset-0">
              <path
                d="M157.86 33.4064C112.951 23.7389 -15.5939 67.2826 10.4488 193.406C43.0023 351.061 338.794 235.376 317.24 119.41C289.711 -28.6976 6.80326 -28.1228 10.4469 131.439C15.2784 343.021 278.78 263.701 309.861 198.898"
                stroke="#FFCE00"
                strokeWidth="14"
                strokeLinecap="round"
              />
            </svg>
            <span className="font-['Grobek'] text-[3rem] font-bold">0%</span>
          </div>
          <h2 className="font-['Grobek'] text-[1.9rem] font-bold tracking-tight sm:text-[2.4rem]">
            Transaction Fees, Always.
          </h2>
        </Reveal>
      </section>

      {/* ================== NOT JUST A LINK-IN-BIO ===================== */}
      <section className="bg-white pb-10 pt-4">
        <Reveal className="mx-auto max-w-2xl px-5 text-center">
          <h2 className="font-['Grobek'] text-[1.9rem] font-bold tracking-tight sm:text-[2.4rem]">
            Not just another link·in·bio 🚀
          </h2>
          <p className="mt-3 text-[15px] text-[#131f60]/60">
            Stan has everything you need to run your business. All-in-one place.
          </p>
        </Reveal>
        <Reveal className="mx-auto mt-10 max-w-4xl px-5">
          <img src="/stan/features.png" alt="Everything Stan can do" loading="lazy" className="w-full" />
        </Reveal>
      </section>

      {/* ===================== A SIMPLER SOLUTION ====================== */}
      <section className="bg-[#f2f4f8] py-20">
        <Reveal className="mx-auto max-w-2xl px-5 text-center">
          <h2 className="font-['Grobek'] text-[1.9rem] font-bold tracking-tight sm:text-[2.4rem]">
            A Simpler Solution 💰
          </h2>
          <p className="mt-3 text-[15px] text-[#131f60]/60">
            No more paying for 5+ different apps! Stan brings it all home.
          </p>
        </Reveal>
        <Reveal className="mx-auto mt-10 flex max-w-[560px] flex-col items-center px-5">
          <img src="/stan/convertkit-auto.png" alt="Stan vs other tools" loading="lazy" className="w-full max-w-[460px]" />
          <TrialButton className="mt-10" />
        </Reveal>
      </section>

      {/* ===================== SETUP STEPS ===================== */}
      <section className="bg-white py-16">
        <FeatureRow
          image="/stan/infographic-2.png"
          title="No Coding Required"
          body="Stan is the simplest and easiest way to get started. You can build your Store in just a few minutes!"
        />
        <FeatureRow
          flip
          image="/stan/infographic-1.png"
          title="1-Tap Checkout"
          body="Your audience shouldn't have to go through hurdles to purchase your product. Stan maximizes your checkout conversion rates."
        />
        <FeatureRow
          image="/stan/infographic.png"
          title="Integrates with Your Favorite Apps"
          body="Stan integrates with all the third party tools you use."
        />

        <Reveal className="mt-10 flex flex-col items-center">
          <h3 className="font-['Grobek'] text-[1.6rem] font-bold tracking-tight sm:text-[2rem]">
            Try Stan for 14 Days Free
          </h3>
          <TrialButton className="mt-7" />
        </Reveal>
      </section>

      {/* ========================== FOOTER ========================== */}
      <footer className="bg-[#f2f4f8] py-14">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-10 px-6 sm:flex-row sm:justify-between">
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-4">
              {SOCIALS.map((s) => (
                <a key={s.alt} href={s.href} target="_blank" rel="noreferrer" className="opacity-70 transition hover:opacity-100">
                  <img src={s.src} alt={s.alt} className="h-6 w-6" />
                </a>
              ))}
            </div>
            <img src="/stan/logo-footer.svg" alt="Stan" className="h-8 w-auto self-start" />
          </div>
          <nav className="grid grid-cols-2 gap-x-12 gap-y-3 text-[15px] font-medium text-[#131f60]/70 sm:flex sm:flex-col sm:items-end sm:gap-2">
            {FOOTER_LINKS.map((l) =>
              l.href.startsWith('/') ? (
                <Link key={l.label} href={l.href} className="hover:text-[#131f60]">{l.label}</Link>
              ) : (
                <a key={l.label} href={l.href} target="_blank" rel="noreferrer" className="hover:text-[#131f60]">{l.label}</a>
              )
            )}
          </nav>
        </div>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Building blocks                                                     */
/* ------------------------------------------------------------------ */

function TrialButton({ className = '' }: { className?: string }) {
  return (
    <Link
      href="/signup"
      className={`group inline-flex items-center gap-3 rounded-full bg-[#6355ff] px-8 py-4 text-[16px] font-bold text-white shadow-[0_14px_34px_-10px_rgba(99,85,255,0.7)] transition hover:brightness-110 ${className}`}
    >
      Start My Trial
      <svg width="20" height="20" viewBox="0 0 23 22" fill="none" className="transition-transform group-hover:translate-x-0.5">
        <path d="M11.1113 1L20.0002 11L11.1113 21" stroke="white" strokeWidth="3" />
        <path d="M19.4444 11H0" stroke="white" strokeWidth="3" />
      </svg>
    </Link>
  );
}

function CreatorHighlight({
  name,
  handle,
  social,
  followers,
  emoji,
  tag,
  img,
  store,
  href,
}: (typeof CREATORS)[number]) {
  return (
    <div className="flex shrink-0 items-stretch gap-4">
      {/* photo card with overlay */}
      <div className="relative h-[440px] w-[300px] overflow-hidden rounded-[28px] shadow-[0_18px_40px_-16px_rgba(20,12,60,0.35)]">
        <img src={img} alt={name} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute bottom-5 left-5 right-5 text-white">
          <div className="font-['Grobek'] text-[1.5rem] font-bold leading-tight">{name}</div>
          <div className="text-[13px] font-semibold text-white/80">{handle}</div>
          <div className="mt-2 flex items-center gap-2">
            <img src={social} alt="" className="h-4 w-4 brightness-0 invert" />
            <span className="text-[13px] font-semibold">{followers}</span>
          </div>
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[12px] font-semibold backdrop-blur">
            <span>{emoji}</span>
            <span className="text-white/60">·</span>
            <span>{tag}</span>
          </div>
        </div>
      </div>
      {/* store screenshot */}
      <a href={href} target="_blank" rel="noreferrer" className="block transition hover:-translate-y-1">
        <img src={store} alt={`${name}'s store`} className="h-[440px] w-auto rounded-[24px] shadow-[0_18px_40px_-16px_rgba(20,12,60,0.35)]" />
      </a>
    </div>
  );
}

function FeatureRow({
  image,
  title,
  body,
  flip = false,
}: {
  image: string;
  title: string;
  body: string;
  flip?: boolean;
}) {
  return (
    <div className="mx-auto grid max-w-4xl items-center gap-8 px-5 py-10 md:grid-cols-2">
      <Reveal className={flip ? 'md:order-2' : ''}>
        <img src={image} alt={title} loading="lazy" className="mx-auto w-full max-w-[460px]" />
      </Reveal>
      <Reveal delay={90} className={flip ? 'md:order-1' : ''}>
        <h3 className="font-['Grobek'] text-[1.7rem] font-bold tracking-tight sm:text-[2.1rem]">{title}</h3>
        <p className="mt-4 max-w-md text-[16px] leading-relaxed text-[#131f60]/70">{body}</p>
      </Reveal>
    </div>
  );
}
