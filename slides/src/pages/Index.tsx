import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Section } from '@/components/Section';
import { PillBase } from '@/components/ui/3d-adaptive-navigation-bar';
import PaperBackground from '@/components/PaperBackground';
import { LinesPatternCard, LinesPatternCardBody } from '@/components/ui/card-with-lines-pattern';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useLanguage } from '@/contexts/LanguageContext';
import dispatchWordmark from '../../../icons/dispatch-name-logo.png';

const problemCards = [
  {
    number: '45.4%',
    text: 'Of discovered vulnerabilities in large enterprises remain unpatched after 12 months, turning remediation backlog into the real security bottleneck.',
    citation: '(EdgeScan, 2025).',
    numberClassName: 'text-destructive',
    borderClassName: 'border-destructive/25',
    shadowClassName: 'shadow-[0_30px_80px_rgba(255,79,79,0.08)]',
  },
  {
    number: '$4.44M',
    text: 'Average global breach cost in 2025, while vulnerability exploitation remained the leading cause of observed cyberattacks.',
    citation: '(IBM, 2025; IBM, 2026).',
    numberClassName: 'text-primary',
    borderClassName: 'border-primary/25',
    shadowClassName: 'shadow-[0_30px_80px_rgba(62,207,142,0.12)]',
  },
  {
    number: '17 hrs',
    text: 'Per week developers can spend on security work, much of it triaging reports and translating findings into fixes by hand.',
    citation: '(Checkmarx, 2025).',
    numberClassName: 'text-accent',
    borderClassName: 'border-accent/25',
    shadowClassName: 'shadow-[0_30px_80px_rgba(24,201,141,0.1)]',
  },
];

const preReconCards = [
  {
    title: 'Route Map',
    text: 'Before any live testing, Dispatch reads the codebase, developer docs, and RULES.md to map endpoints, handler files, middleware chains, and parameters.',
    citation: '(OWASP Foundation, 2020; Scarfone et al., 2008).',
    accentClassName: 'text-primary',
    borderClassName: 'border-primary/30',
  },
  {
    title: 'Risk Signals',
    text: 'The orchestrator flags raw SQL concatenation, missing auth middleware, hardcoded secrets, eval/exec use, and unvalidated input to focus the attack surface.',
    citation: '(OWASP Foundation, 2021).',
    accentClassName: 'text-secondary',
    borderClassName: 'border-secondary/30',
  },
  {
    title: 'Attack Matrix',
    text: 'Those signals become an endpoint-by-attack-type matrix so Dispatch sends workers only where the code suggests real risk, instead of blasting the whole app blindly.',
    citation: '(Scarfone et al., 2008; OWASP Foundation, 2020).',
    accentClassName: 'text-accent',
    borderClassName: 'border-accent/30',
  },
];

const architectureCards = [
  {
    title: 'Orchestrator',
    text: 'Ingests the codebase, spec, and team rules, uses runtime context, and decides which workers to launch first.',
    citation: '(Souppaya et al., 2022).',
    accentClassName: 'text-primary',
    borderClassName: 'border-primary/30',
  },
  {
    title: 'Pentester Workers',
    text: 'Specialized workers cover route/auth, injection, auth, config, AI-agent security, and UI flows, then report file, line, severity, reproduction, and suggested fix.',
    citation: '(OWASP Foundation, 2021; Booth et al., 2024).',
    accentClassName: 'text-secondary',
    borderClassName: 'border-secondary/30',
  },
  {
    title: 'Construction Worker',
    text: 'Reads the tracked finding, patches the code, validates the fix, and updates remediation state so progress stays visible and verifiable.',
    citation: '(Souppaya et al., 2022; OWASP Foundation, 2025).',
    accentClassName: 'text-accent',
    borderClassName: 'border-accent/30',
  },
];

const workflowSteps = [
  { title: 'Pre-Recon', borderClassName: 'border-primary/30', arrowClassName: 'text-primary' },
  { title: 'Pentest Worker', borderClassName: 'border-secondary/30', arrowClassName: 'text-secondary' },
  { title: 'GitHub Issue', borderClassName: 'border-accent/30', arrowClassName: 'text-accent' },
  { title: 'Fix PR', borderClassName: 'border-destructive/30', arrowClassName: 'text-destructive' },
];

const workflowArtifacts = [
  {
    title: 'Route Map + Briefing',
    text: 'Handlers, middleware, parameters, risk signals, and rules-aware targeting.',
    citation: '(OWASP Foundation, 2020; Scarfone et al., 2008).',
    accentClassName: 'text-primary',
    borderClassName: 'border-primary/30',
    bgClassName: 'bg-primary/10',
  },
  {
    title: 'Finding Report + Logs',
    text: 'Exploit evidence, localhost log capture, monkeypatch attempts, and clean endpoints tested.',
    citation: '(Scarfone et al., 2008; OWASP Foundation, 2025).',
    accentClassName: 'text-secondary',
    borderClassName: 'border-secondary/30',
    bgClassName: 'bg-secondary/10',
  },
  {
    title: 'Tagged Issue + Repro',
    text: 'Severity, OWASP mapping, reproduction steps, logs, recommended fix, and lifecycle labels.',
    citation: '(OWASP Foundation, 2025; Souppaya et al., 2022).',
    accentClassName: 'text-accent',
    borderClassName: 'border-accent/30',
    bgClassName: 'bg-accent/10',
  },
  {
    title: 'Validated Patch + Audit Trail',
    text: 'Construction worker patch, verification result, review link, and issue thread as the permanent record.',
    citation: '(Souppaya et al., 2022; OWASP Foundation, 2025).',
    accentClassName: 'text-destructive',
    borderClassName: 'border-destructive/30',
    bgClassName: 'bg-destructive/10',
  },
];

const outputCards = [
  {
    title: 'Interactive Graph View',
    text: 'Endpoints, files, and findings become a severity-colored network so developers can drill into relationships instead of scanning a static report.',
    citation: '(Hasselbring et al., 2020).',
    accentClassName: 'text-primary',
    borderClassName: 'border-primary/30',
  },
  {
    title: 'PDF Reports',
    text: 'Executive summary plus critical/high/medium-low sections, with GitHub permalinks and linked tickets on every page.',
    citation: '(OWASP Foundation, 2025; Scarfone et al., 2008).',
    accentClassName: 'text-secondary',
    borderClassName: 'border-secondary/30',
  },
  {
    title: 'RAG Q&A',
    text: 'Developers ask natural-language questions like "What is the most critical finding?" and get direct answers with code references.',
    citation: '(Lewis et al., 2020).',
    accentClassName: 'text-accent',
    borderClassName: 'border-accent/30',
  },
  {
    title: 'Workflow Integrations',
    text: 'Chat, ticketing, observability, and browser-automation integrations keep Dispatch inside the tooling developers already use.',
    citation: '(Souppaya et al., 2022).',
    accentClassName: 'text-destructive',
    borderClassName: 'border-destructive/30',
  },
];

const fixLoopCards = [
  {
    title: 'Exploit Confidence',
    badge: 'exploit:confirmed | exploit:unconfirmed',
    text: 'Dispatch distinguishes suspicious code patterns from vulnerabilities it actually reproduced against the live app.',
    citation: '(Scarfone et al., 2008).',
    accentClassName: 'text-primary',
    borderClassName: 'border-primary/30',
  },
  {
    title: 'Monkeypatch Status',
    badge: 'validated | failed | not-attempted',
    text: 'Pentester workers try fast proof fixes, restart the app, and re-attack so the next worker knows whether the direction is sound.',
    citation: '(Souppaya et al., 2022).',
    accentClassName: 'text-secondary',
    borderClassName: 'border-secondary/30',
  },
  {
    title: 'Fix Status',
    badge: 'unfixed -> in-progress -> verified',
    text: 'Construction workers update issue labels as they patch, validate, and open PRs, making remediation state visible to everyone.',
    citation: '(Souppaya et al., 2022; OWASP Foundation, 2025).',
    accentClassName: 'text-accent',
    borderClassName: 'border-accent/30',
  },
];

const summaryCards = [
  {
    title: 'Research-Informed',
    text: 'Threat-informed testing, staged execution, and evidence-first reporting shape Dispatch from the start.',
    citation: '(Scarfone et al., 2008; OWASP Foundation, 2025).',
    accentClassName: 'text-primary',
    borderClassName: 'border-primary/30',
  },
  {
    title: 'Developer-Native',
    text: 'Grounded Q&A, tracked remediation, and workflow integrations keep security inside the engineering loop instead of a separate silo.',
    citation: '(Souppaya et al., 2022; Lewis et al., 2020).',
    accentClassName: 'text-secondary',
    borderClassName: 'border-secondary/30',
  },
  {
    title: 'Closed Loop',
    text: 'Dispatch differentiates on code-aware planning, structured findings, automated remediation, and verification after the patch.',
    citation: '(Souppaya et al., 2022; OWASP Foundation, 2025).',
    accentClassName: 'text-accent',
    borderClassName: 'border-accent/30',
  },
];

const businessTiers = [
  {
    name: 'Free',
    price: '$0',
    period: '/mo',
    subtitle: 'Solo devs and side projects',
    features: [
      '5 scans per month',
      '1 repo workspace',
      'Severity dashboard',
      'OWASP tagging',
      'Issue export',
    ],
    borderClassName: 'border-white/10',
    dotClassName: 'bg-primary',
    priceClassName: 'text-4xl md:text-5xl text-foreground',
    shadowClassName: 'shadow-[0_24px_70px_rgba(0,0,0,0.22)]',
  },
  {
    name: 'Startup',
    price: '$99',
    period: '/mo',
    subtitle: 'Small teams shipping fast',
    features: [
      '50 scans per month',
      'AI attack testing',
      'GitHub or Linear tickets',
      'Fixer-agent PR drafts',
      'Code-aware planning',
    ],
    borderClassName: 'border-secondary/30',
    dotClassName: 'bg-secondary',
    priceClassName: 'text-4xl md:text-5xl text-secondary',
    shadowClassName: 'shadow-[0_24px_70px_rgba(33,166,103,0.12)]',
  },
  {
    name: 'Team',
    price: '$299',
    period: '/mo',
    subtitle: 'Growing engineering teams',
    features: [
      'Everything in Startup',
      'CI/CD scans on every push',
      'Slack alerts on critical findings',
      'PDF and compliance-ready reports',
      'Multi-repo workspace',
    ],
    borderClassName: 'border-primary/70',
    dotClassName: 'bg-primary',
    priceClassName: 'text-4xl md:text-5xl text-primary',
    shadowClassName: 'shadow-[0_32px_90px_rgba(62,207,142,0.18)]',
    badge: 'Most popular',
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    subtitle: 'Large orgs and compliance-heavy teams',
    features: [
      'Everything in Team',
      'Human security engineer review',
      'SSO and audit logs',
      'VPC or self-hosted runner options',
      'Custom SLA and procurement support',
    ],
    borderClassName: 'border-accent/35',
    dotClassName: 'bg-accent',
    priceClassName: 'text-3xl md:text-4xl text-accent',
    shadowClassName: 'shadow-[0_24px_70px_rgba(20,141,120,0.12)]',
  },
];

const businessModelRows = [
  { label: 'Primary revenue', value: 'Monthly and annual SaaS subscriptions' },
  { label: 'Secondary revenue', value: 'Usage overages on scans and agent runtime' },
  { label: 'Enterprise revenue', value: 'Human review, VPC, and compliance add-ons' },
  { label: 'Pricing model', value: 'Hybrid: platform fee + usage' },
  { label: 'Billing', value: 'Monthly by default, annual discount available' },
  { label: 'Growth motion', value: 'Bottom-up -> team expansion -> enterprise' },
];

const upgradeRows = [
  { label: 'Free -> Startup', value: 'Hit scan cap or need auto-fix PRs' },
  { label: 'Startup -> Team', value: 'Need CI/CD, Slack alerts, and multi-repo' },
  { label: 'Team -> Enterprise', value: 'Need SSO, audit logs, or VPC deployment' },
  { label: 'Compliance trigger', value: 'SOC 2 / ISO 27001 evidence for procurement' },
  { label: 'Market benchmark', value: '$25-$40/dev/mo or €90/app/mo', isBadge: true },
];

const marketCards = [
  {
    title: 'TAM',
    value: '$13.6B',
    description: 'Every company worldwide that buys security testing tools',
    bullets: [
      'Any industry, any size, any geography',
      'SAST, DAST, and penetration-testing budgets',
    ],
    borderClassName: 'border-[#5a98f2]/45',
    accentClassName: 'text-[#7fb0ff]',
    dotClassName: 'bg-[#4a90ff]',
    shadowClassName: 'shadow-[0_28px_80px_rgba(74,144,255,0.14)]',
  },
  {
    title: 'SAM',
    value: '$1.5B',
    description: 'SaaS companies with a GitHub repo and 5-500 engineers',
    bullets: [
      'Cloud-native, English-first markets (US, UK, CA, AU)',
      'Teams shipping continuously under compliance pressure',
    ],
    borderClassName: 'border-primary/45',
    accentClassName: 'text-primary',
    dotClassName: 'bg-primary',
    shadowClassName: 'shadow-[0_28px_80px_rgba(62,207,142,0.14)]',
  },
  {
    title: 'SOM - Year 3',
    value: '$0.75M-$2.5M',
    description: 'Series A-B startups finding Dispatch via GitHub or dev communities',
    bullets: [
      '10-100 engineers, hitting a SOC 2 or fundraise deadline',
      'Teams that outgrow the Free tier and need auto-fix PRs',
    ],
    borderClassName: 'border-[#d9a441]/45',
    accentClassName: 'text-[#e4b24d]',
    dotClassName: 'bg-[#c88419]',
    shadowClassName: 'shadow-[0_28px_80px_rgba(217,164,65,0.14)]',
  },
];

const competitorRows = [
  {
    tool: 'Casco',
    description: 'YC S25 · Agentic pentest',
    pricing: 'Custom (startup-focused)',
    features: ['yes', 'yes', 'yes', 'no', 'no', 'partial', 'no', 'yes'],
  },
  {
    tool: 'Aikido',
    description: 'Unified AppSec + AI pentest',
    pricing: 'Per app (custom quote)',
    features: ['partial', 'yes', 'yes', 'partial', 'no', 'yes', 'yes', 'yes'],
  },
  {
    tool: 'XBOW',
    description: 'Autonomous pentest agent',
    pricing: 'Custom (early access)',
    features: ['yes', 'yes', 'yes', 'no', 'no', 'no', 'no', 'partial'],
  },
  {
    tool: 'Escape',
    description: 'API security / agentic',
    pricing: 'From €500/mo',
    features: ['partial', 'yes', 'partial', 'no', 'no', 'yes', 'yes', 'yes'],
  },
  {
    tool: 'Pentest firm',
    description: 'Manual / human',
    pricing: '$5K-$100K/yr',
    features: ['yes', 'no', 'yes', 'no', 'no', 'no', 'no', 'yes'],
  },
  {
    tool: 'Dispatch',
    description: 'Agentic AppSec',
    pricing: '$0-$299/mo flat',
    features: ['yes', 'yes', 'yes', 'yes', 'yes', 'yes', 'yes', 'yes'],
    isDispatch: true,
  },
];

const competitorColumns = [
  'Code-aware recon',
  'Agentic testing',
  'Exploit validation',
  'Auto-fix PR',
  'Verified remediation',
  'GitHub native',
  'CI/CD',
  'Compliance report',
];

const forceCards = [
  {
    title: 'Threat of New Entrants',
    level: 'Medium-High',
    levelClassName: 'bg-[#5a4311] text-[#e4b24d]',
    barClassName: 'bg-[#d28a1d]',
    widthClassName: 'w-[68%]',
    text: 'AI tooling costs are falling fast. Moats must come from data network effects and developer workflow stickiness, not the orchestrator pattern alone.',
  },
  {
    title: 'Bargaining Power of Buyers',
    level: 'Medium',
    levelClassName: 'bg-[#5a4311] text-[#e4b24d]',
    barClassName: 'bg-[#d28a1d]',
    widthClassName: 'w-[56%]',
    text: 'Developers have many alternatives, but switching cost rises once Dispatch is embedded into CI/CD and GitHub workflows.',
  },
  {
    title: 'Bargaining Power of Suppliers',
    level: 'Low',
    levelClassName: 'bg-[#214b18] text-[#7fd14c]',
    barClassName: 'bg-[#15876d]',
    widthClassName: 'w-[26%]',
    text: 'LLM APIs are the main supplier dependency. Multi-model support is straightforward and cloud infrastructure remains commoditized.',
  },
  {
    title: 'Threat of Substitutes',
    level: 'High',
    levelClassName: 'bg-[#5e2a25] text-[#f27e73]',
    barClassName: 'bg-[#be3a35]',
    widthClassName: 'w-[80%]',
    text: 'Snyk, Semgrep, GitHub Advanced Security, Checkmarx, Veracode, and manual pentests all compete for the same budget.',
  },
  {
    title: 'Competitive Rivalry',
    level: 'High',
    levelClassName: 'bg-[#5e2a25] text-[#f27e73]',
    barClassName: 'bg-[#be3a35]',
    widthClassName: 'w-[84%]',
    text: "Dispatch's agentic remediation loop is differentiated today, but larger AppSec vendors can close feature gaps quickly if customer pull is real.",
    fullWidth: true,
  },
];

const Citation = ({ text, className = '' }: { text: string; className?: string }) => (
  <p className={`mt-4 text-xs leading-relaxed tracking-wide text-muted-foreground/70 ${className}`}>
    {text}
  </p>
);

const SECTION_IDS = ['home', 'problem', 'clinical', 'solution', 'how-it-works', 'dashboard', 'muscle', 'summary', 'business-model', 'market-size', 'competition'];

const Index = () => {
  const { t } = useLanguage();
  const [activeSection, setActiveSection] = useState('home');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const teamMembers = [
    { name: 'Arsh Singh', role: 'Computer Science', initials: 'A', image: '/arsh.jpeg' },
    { name: 'Mateo del Rio Lanse', role: 'Electrical & Computer Engineering', initials: 'M', image: '/Mateo_Headshot.jpeg' },
    { name: 'Diya Sheth', role: 'Mechanical Engineering', initials: 'D', image: '/Diya_Headshot.jpeg' },
    { name: 'Jimmy Mulosmani', role: 'Computer Science', initials: 'J', image: '/Jimmy_Headshot.jpeg' },
  ];

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const viewportH = container.clientHeight;
      const scrollMid = scrollTop + viewportH / 2;

      for (const sectionId of SECTION_IDS) {
        const el = document.getElementById(sectionId);
        if (el) {
          const top = el.offsetTop;
          if (scrollMid >= top && scrollMid < top + el.offsetHeight) {
            setActiveSection(sectionId);
            break;
          }
        }
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="relative min-h-screen">
      <PaperBackground />

      <div className="fixed left-8 top-8 z-50">
        <img
          src={dispatchWordmark}
          alt="Dispatch logo"
          className="h-10 w-auto object-contain shadow-[0_18px_40px_rgba(0,0,0,0.28)] md:h-12"
        />
      </div>

      <div className="fixed top-8 left-1/2 z-50 -translate-x-1/2">
        <PillBase activeSection={activeSection} onSectionClick={scrollToSection} />
      </div>

      <div ref={scrollContainerRef} className="snap-y snap-mandatory h-screen overflow-y-scroll relative">
        <Section id="home" className="bg-transparent" contentClassName="max-w-7xl py-16 lg:py-20">
          <div className="space-y-12">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
              className="mx-auto max-w-6xl text-center"
            >
              <img
                src={dispatchWordmark}
                alt={t('home.title')}
                className="mx-auto w-full max-w-[32rem] sm:max-w-[38rem] md:max-w-[44rem] xl:max-w-[52rem] object-contain drop-shadow-[0_28px_50px_rgba(0,0,0,0.3)]"
              />
            </motion.div>

            <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-4 max-w-7xl mx-auto mt-14">
              {teamMembers.map((member, index) => (
                <motion.div
                  key={member.name}
                  initial={{ opacity: 0, y: 50 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.2 + index * 0.15 }}
                >
                  <LinesPatternCard
                    className="h-[24rem] rounded-[2rem] shadow-2xl"
                    patternClassName="h-full overflow-hidden rounded-[1.25rem]"
                    gradientClassName="h-full overflow-hidden rounded-[1.25rem]"
                  >
                    <LinesPatternCardBody className="h-full rounded-[1.25rem] bg-gradient-to-br from-primary/10 to-secondary/5 p-0 md:p-0">
                      <div className="flex h-full flex-col items-center px-5 py-8 text-center sm:px-6">
                        {member.image ? (
                          <div className="flex h-36 items-center justify-center">
                            <div className="h-32 w-32 overflow-hidden rounded-full border border-primary/20 shadow-sm">
                              <img
                                src={member.image}
                                alt={member.name}
                                className="h-full w-full object-cover"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="flex h-36 items-center justify-center">
                            <div className="flex h-32 w-32 items-center justify-center rounded-full border border-primary/20 bg-background/80 text-3xl font-bold text-primary shadow-sm">
                              {member.initials}
                            </div>
                          </div>
                        )}
                        <div className="mt-6 flex min-h-[7.5rem] w-full flex-col items-center">
                          <p className="text-xl leading-tight text-foreground font-semibold">{member.name}</p>
                          <p className="mt-3 w-full text-[0.95rem] leading-tight text-muted-foreground">{member.role}</p>
                          <p className="mt-2 text-sm font-bold tracking-wide text-foreground">
                            Cornell University
                          </p>
                        </div>
                      </div>
                    </LinesPatternCardBody>
                  </LinesPatternCard>
                </motion.div>
              ))}
            </div>

            <motion.p
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
              className="mx-auto mt-10 w-fit whitespace-nowrap text-center text-xl font-light leading-none text-muted-foreground md:text-2xl xl:text-[2rem]"
            >
              {t('home.subtitle')}
            </motion.p>
          </div>
        </Section>

        <Section id="problem" className="bg-transparent" contentClassName="max-w-7xl py-8">
          <div className="space-y-5">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              viewport={{ once: false, amount: 0.45 }}
              className="max-w-6xl mx-auto text-center space-y-2"
            >
              <h2 className="text-3xl md:text-5xl xl:text-6xl font-black tracking-tight leading-[1.05] text-foreground">
                A pentest finds your vulnerabilities... but it still costs
              </h2>
              <div className="text-5xl md:text-7xl font-black tracking-tight text-destructive">
                $5K-$100K+
              </div>
              <Citation
                text={'(Invicti, 2025).'}
                className="text-center max-w-3xl mx-auto !mt-2"
              />
            </motion.div>

            <div className="grid max-w-7xl mx-auto gap-4 lg:grid-cols-3">
              {problemCards.map((card, index) => (
                <motion.div
                  key={card.number}
                  initial={{ opacity: 0, y: 32 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, delay: 0.12 * index }}
                  viewport={{ once: false, amount: 0.35 }}
                  className={`h-full rounded-[2rem] border bg-card/90 px-6 py-6 backdrop-blur-md ${card.borderClassName} ${card.shadowClassName}`}
                >
                  <div className={`text-5xl md:text-6xl font-black tracking-tight ${card.numberClassName}`}>
                    {card.number}
                  </div>
                  <p className="mt-3 text-base md:text-lg leading-relaxed text-muted-foreground">
                    {card.text}
                  </p>
                  <Citation text={card.citation} className="!mt-2" />
                </motion.div>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.35 }}
              viewport={{ once: false, amount: 0.35 }}
              className="relative max-w-7xl mx-auto pt-2"
            >
              <div className="rounded-[2rem] border border-primary/20 bg-card/90 px-6 py-6 text-center shadow-[0_30px_90px_rgba(33,117,78,0.22)] backdrop-blur-md">
                <p className="mx-auto max-w-6xl text-xl font-bold leading-snug text-foreground md:text-2xl">
                  How do we turn security testing into tickets, fixes, and verified PRs instead of yet another PDF?
                </p>
                <Citation
                  text={'(Invicti, 2025; IBM, 2025).'}
                  className="text-center !mt-2"
                />
              </div>
            </motion.div>
          </div>
        </Section>

        <Section id="clinical" className="bg-transparent">
          <div className="space-y-8">
            <div className="text-center space-y-4">
              <h1 className="text-5xl md:text-7xl font-bold text-foreground">Pre-Recon Intelligence</h1>
              <p className="max-w-4xl mx-auto text-xl md:text-2xl text-muted-foreground">
                Dispatch does not start by attacking blindly. It plans from the codebase first.
              </p>
            </div>

            <div className="grid max-w-7xl mx-auto gap-6 md:grid-cols-3">
              {preReconCards.map((card, index) => (
                <motion.div
                  key={card.title}
                  initial={{ opacity: 0, y: 28 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, delay: 0.1 * index }}
                >
                  <LinesPatternCard className={`rounded-2xl shadow-xl h-full ${card.borderClassName}`}>
                    <LinesPatternCardBody className="p-8">
                      <h3 className={`text-3xl font-bold mb-5 ${card.accentClassName}`}>{card.title}</h3>
                      <p className="text-foreground text-xl leading-relaxed">{card.text}</p>
                      <Citation text={card.citation} />
                    </LinesPatternCardBody>
                  </LinesPatternCard>
                </motion.div>
              ))}
            </div>

            <LinesPatternCard className="max-w-6xl mx-auto rounded-2xl shadow-2xl border-primary/25">
              <LinesPatternCardBody className="p-8 text-center">
                <p className="text-2xl md:text-3xl font-semibold text-foreground leading-snug">
                  Before any live testing, the orchestrator runs a code-analysis-only pass to produce a route map, dependency graph, risk signals, and the attack matrix that drives worker assignment.
                </p>
                <Citation
                  text={'(Scarfone et al., 2008; OWASP Foundation, 2020).'}
                  className="text-center"
                />
              </LinesPatternCardBody>
            </LinesPatternCard>
          </div>
        </Section>

        <Section id="solution" className="bg-transparent" contentClassName="max-w-6xl py-12">
          <div className="space-y-6">
            <div className="text-center space-y-3">
              <h1 className="text-5xl md:text-6xl font-bold text-foreground">Dispatch Architecture</h1>
              <p className="text-xl md:text-2xl text-muted-foreground font-light max-w-4xl mx-auto">
                Security tools give you a PDF. Dispatch gives you a pull request.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-5 max-w-6xl mx-auto">
              {architectureCards.map((card, index) => (
                <motion.div
                  key={card.title}
                  initial={{ opacity: 0, y: 28 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, delay: 0.12 * index }}
                >
                  <LinesPatternCard className={`rounded-2xl shadow-xl h-full ${card.borderClassName}`}>
                    <LinesPatternCardBody className="p-6 text-center">
                      <h3 className={`text-2xl font-bold mb-3 ${card.accentClassName}`}>{card.title}</h3>
                      <p className="text-foreground text-lg leading-relaxed">{card.text}</p>
                      <Citation text={card.citation} className="text-center !mt-2" />
                    </LinesPatternCardBody>
                  </LinesPatternCard>
                </motion.div>
              ))}
            </div>

            <LinesPatternCard className="max-w-6xl mx-auto rounded-2xl shadow-2xl border-accent/30">
              <LinesPatternCardBody className="text-center p-7">
                <div className="text-3xl md:text-4xl font-bold text-accent mb-2">
                  Triggered from chat, your terminal, or the dashboard
                </div>
                <p className="text-xl text-foreground font-semibold mb-1">
                  Findings become tracked remediation work. Remediation work becomes validated code changes.
                </p>
                <Citation
                  text={'(Souppaya et al., 2022; OWASP Foundation, 2025).'}
                  className="text-center !mt-2"
                />
              </LinesPatternCardBody>
            </LinesPatternCard>
          </div>
        </Section>

        <Section id="how-it-works" className="bg-transparent">
          <div className="space-y-8">
            <div className="text-center space-y-4">
              <h1 className="text-5xl md:text-7xl font-bold text-foreground">How Dispatch Works</h1>
              <p className="max-w-4xl mx-auto text-xl md:text-2xl text-muted-foreground">
                The workflow moves from intelligence gathering to exploitation, to issue creation, to verified remediation.
              </p>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="flex flex-wrap items-center justify-center gap-3 max-w-6xl mx-auto"
            >
              {workflowSteps.map((step, index) => (
                <div key={step.title} className="flex items-center gap-3">
                  <LinesPatternCard className={`rounded-lg shadow-lg ${step.borderClassName}`}>
                    <LinesPatternCardBody className="px-4 py-3 text-center h-16 flex items-center justify-center">
                      <p className="text-xl font-semibold text-foreground whitespace-nowrap">{step.title}</p>
                    </LinesPatternCardBody>
                  </LinesPatternCard>

                  {index < workflowSteps.length - 1 && (
                    <div className={`text-2xl font-bold ${step.arrowClassName}`}>→</div>
                  )}
                </div>
              ))}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
            >
              <LinesPatternCard className="rounded-2xl shadow-2xl border-primary/40 max-w-7xl mx-auto">
                <LinesPatternCardBody className="p-8">
                  <h3 className="text-3xl font-bold text-foreground mb-8 text-center">Artifacts At Each Stage</h3>
                  <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                    {workflowArtifacts.map((artifact) => (
                      <div
                        key={artifact.title}
                        className={`rounded-2xl border p-6 text-left ${artifact.bgClassName} ${artifact.borderClassName}`}
                      >
                        <p className={`text-2xl font-semibold ${artifact.accentClassName}`}>{artifact.title}</p>
                        <p className="mt-4 text-lg leading-relaxed text-foreground">{artifact.text}</p>
                        <Citation text={artifact.citation} />
                      </div>
                    ))}
                  </div>
                </LinesPatternCardBody>
              </LinesPatternCard>
            </motion.div>
          </div>
        </Section>

        <Section id="dashboard" className="bg-transparent" contentClassName="max-w-7xl py-8">
          <div className="space-y-5">
            <div className="text-center space-y-2">
              <h1 className="text-4xl md:text-6xl font-bold text-foreground">Outputs Developers Actually Use</h1>
              <p className="max-w-5xl mx-auto text-lg md:text-xl text-muted-foreground">
                Dispatch is designed around operational outputs developers can act on immediately, not another dead-end report.
              </p>
            </div>

            <div className="grid gap-4 max-w-7xl mx-auto md:grid-cols-2">
              {outputCards.map((card, index) => (
                <motion.div
                  key={card.title}
                  initial={{ opacity: 0, y: 28 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, delay: 0.1 * index }}
                >
                  <LinesPatternCard className={`rounded-2xl shadow-xl h-full ${card.borderClassName}`}>
                    <LinesPatternCardBody className="p-5">
                      <h3 className={`text-2xl font-bold mb-2 ${card.accentClassName}`}>{card.title}</h3>
                      <p className="text-foreground text-base leading-relaxed">{card.text}</p>
                      <Citation text={card.citation} className="!mt-2" />
                    </LinesPatternCardBody>
                  </LinesPatternCard>
                </motion.div>
              ))}
            </div>

            <LinesPatternCard className="max-w-6xl mx-auto rounded-2xl shadow-2xl border-secondary/30">
              <LinesPatternCardBody className="p-6 text-center">
                <p className="text-lg md:text-xl font-semibold text-foreground leading-snug">
                  The barrier to running a security test drops to zero: no separate workflow, no manual triage spreadsheet, just the tools the team already uses.
                </p>
                <Citation
                  text={'(Souppaya et al., 2022).'}
                  className="text-center !mt-2"
                />
              </LinesPatternCardBody>
            </LinesPatternCard>
          </div>
        </Section>

        <Section id="muscle" className="bg-transparent" contentClassName="max-w-7xl py-12">
          <div className="space-y-6">
            <div className="text-center space-y-3">
              <h1 className="text-5xl md:text-6xl font-bold text-foreground">GitHub Issue = The Contract</h1>
              <p className="max-w-5xl mx-auto text-lg md:text-xl text-muted-foreground">
                Dispatch keeps the fix loop explicit by making the issue itself the machine-readable handoff between pentesting and remediation.
              </p>
            </div>

            <div className="grid gap-5 max-w-7xl mx-auto md:grid-cols-3">
              {fixLoopCards.map((card, index) => (
                <motion.div
                  key={card.title}
                  initial={{ opacity: 0, y: 28 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, delay: 0.1 * index }}
                >
                  <LinesPatternCard className={`rounded-2xl shadow-xl h-full ${card.borderClassName}`}>
                    <LinesPatternCardBody className="p-6">
                      <p className={`text-sm font-semibold tracking-[0.18em] uppercase ${card.accentClassName}`}>{card.badge}</p>
                      <h3 className="mt-3 text-2xl font-bold text-foreground">{card.title}</h3>
                      <p className="mt-3 text-lg leading-relaxed text-muted-foreground">{card.text}</p>
                      <Citation text={card.citation} className="!mt-2" />
                    </LinesPatternCardBody>
                  </LinesPatternCard>
                </motion.div>
              ))}
            </div>

            <LinesPatternCard className="max-w-6xl mx-auto rounded-2xl shadow-2xl border-accent/30">
              <LinesPatternCardBody className="p-6">
                <p className="text-xl md:text-2xl font-semibold text-foreground leading-snug text-center">
                  The issue body carries metadata, reproduction steps, server logs, monkeypatch diff, RULES.md violations, and the recommended fix. The issue thread becomes the audit trail: finding, fix attempt, and PR all live in one place.
                </p>
                <Citation
                  text={'(OWASP Foundation, 2025; Scarfone et al., 2008).'}
                  className="text-center !mt-2"
                />
              </LinesPatternCardBody>
            </LinesPatternCard>
          </div>
        </Section>

        <Section id="summary" className="bg-transparent" contentClassName="max-w-6xl py-12">
          <div className="space-y-6">
            <div className="text-center space-y-3">
              <h1 className="text-5xl md:text-6xl font-bold text-foreground">Why Dispatch Stands Out</h1>
              <p className="max-w-5xl mx-auto text-xl md:text-2xl text-muted-foreground">
                Dispatch is not just another scanner. It is a developer-native remediation workflow built on top of code-aware security testing.
              </p>
            </div>

            <div className="grid gap-5 max-w-7xl mx-auto md:grid-cols-3">
              {summaryCards.map((card, index) => (
                <motion.div
                  key={card.title}
                  initial={{ opacity: 0, y: 28 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, delay: 0.1 * index }}
                >
                  <LinesPatternCard className={`rounded-2xl shadow-xl h-full ${card.borderClassName}`}>
                    <LinesPatternCardBody className="p-6">
                      <h3 className={`text-2xl font-bold mb-3 ${card.accentClassName}`}>{card.title}</h3>
                      <p className="text-foreground text-lg leading-relaxed">{card.text}</p>
                      <Citation text={card.citation} className="!mt-2" />
                    </LinesPatternCardBody>
                  </LinesPatternCard>
                </motion.div>
              ))}
            </div>

            <LinesPatternCard className="max-w-6xl mx-auto rounded-2xl shadow-2xl border-primary/30">
              <LinesPatternCardBody className="p-7 text-center">
                <p className="text-3xl md:text-4xl font-bold text-foreground leading-tight">
                  Security tools give you a PDF. Dispatch gives you a pull request.
                </p>
                <p className="mt-3 text-lg md:text-xl text-muted-foreground max-w-4xl mx-auto leading-relaxed">
                  The next step is obvious: run this on every push, prioritize by real-world runtime risk, and keep the fix loop inside the developer workflow from start to finish.
                </p>
                <Citation
                  text={'(Souppaya et al., 2022; Lewis et al., 2020).'}
                  className="text-center !mt-2"
                />
              </LinesPatternCardBody>
            </LinesPatternCard>
          </div>
        </Section>

        <Section id="business-model" className="bg-transparent" contentClassName="max-w-7xl py-6">
          <div className="space-y-4">
            <div className="text-center space-y-1">
              <h1 className="text-4xl md:text-5xl font-bold text-foreground">Dispatch Business Model</h1>
              <p className="max-w-5xl mx-auto text-base md:text-lg text-muted-foreground">
                Self-serve pricing for developers, expansion revenue from teams, and enterprise upsell when compliance and sign-off matter.
              </p>
              <Citation
                text={'(Snyk, 2026; Semgrep, 2026; Detectify, 2026).'}
                className="text-center !mt-1"
              />
            </div>

            <div className="grid max-w-7xl mx-auto gap-4 md:grid-cols-2 xl:grid-cols-4">
              {businessTiers.map((tier, index) => (
                <motion.div
                  key={tier.name}
                  initial={{ opacity: 0, y: 28 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, delay: 0.08 * index }}
                  className="relative"
                >
                  {tier.badge ? (
                    <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary px-4 py-1 text-xs font-semibold text-primary-foreground shadow-[0_18px_40px_rgba(62,207,142,0.25)]">
                      {tier.badge}
                    </div>
                  ) : null}
                  <div className={`h-full rounded-[1.5rem] border bg-card/90 px-5 py-5 backdrop-blur-md ${tier.borderClassName} ${tier.shadowClassName}`}>
                    <p className="text-xl font-bold text-foreground">{tier.name}</p>
                    <div className="mt-2 flex items-end gap-1">
                      <span className={`font-black tracking-tight ${tier.priceClassName}`}>{tier.price}</span>
                      {tier.period ? (
                        <span className="pb-1 text-xl font-semibold text-muted-foreground">{tier.period}</span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{tier.subtitle}</p>

                    <div className="mt-3 border-t border-border/60 pt-3">
                      <ul className="space-y-1.5">
                        {tier.features.map((feature) => (
                          <li key={feature} className="flex items-start gap-2 text-sm">
                            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${tier.dotClassName}`} />
                            <span className="text-foreground/90">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="grid max-w-7xl mx-auto gap-4 lg:grid-cols-2">
              <LinesPatternCard className="rounded-[1.5rem] shadow-2xl border-primary/25">
                <LinesPatternCardBody className="p-5">
                  <h3 className="text-xl md:text-2xl font-bold text-foreground mb-3">How Dispatch makes money</h3>
                  <div className="space-y-1.5">
                    {businessModelRows.map((row) => (
                      <div
                        key={row.label}
                        className="flex flex-col gap-1 border-b border-border/60 pb-1.5 md:flex-row md:items-center md:justify-between"
                      >
                        <span className="text-sm md:text-base text-muted-foreground">{row.label}</span>
                        <span className="text-sm md:text-base font-semibold text-foreground md:text-right">{row.value}</span>
                      </div>
                    ))}
                  </div>
                </LinesPatternCardBody>
              </LinesPatternCard>

              <LinesPatternCard className="rounded-[1.5rem] shadow-2xl border-secondary/30">
                <LinesPatternCardBody className="p-5">
                  <h3 className="text-xl md:text-2xl font-bold text-foreground mb-3">Upgrade triggers and market anchors</h3>
                  <div className="space-y-1.5">
                    {upgradeRows.map((row) => (
                      <div
                        key={row.label}
                        className="flex flex-col gap-1 border-b border-border/60 pb-1.5 md:flex-row md:items-center md:justify-between"
                      >
                        <span className="text-sm md:text-base text-muted-foreground">{row.label}</span>
                        {row.isBadge ? (
                          <span className="inline-flex items-center rounded-full bg-primary/15 px-3 py-1 text-sm font-semibold text-primary">
                            {row.value}
                          </span>
                        ) : (
                          <span className="text-sm md:text-base font-semibold text-foreground md:text-right">{row.value}</span>
                        )}
                      </div>
                    ))}
                  </div>
                  <Citation
                    text={'(Snyk, 2026; Semgrep, 2026; Detectify, 2026; Vanta, 2026).'}
                    className="!mt-2"
                  />
                </LinesPatternCardBody>
              </LinesPatternCard>
            </div>
          </div>
        </Section>

        <Section id="market-size" className="bg-transparent">
          <div className="space-y-8">
            <div className="text-center space-y-4">
              <h1 className="text-5xl md:text-7xl font-bold text-foreground">Market Size</h1>
              <p className="max-w-5xl mx-auto text-xl md:text-2xl text-muted-foreground">
                A top-down view of where Dispatch can win first, then expand.
              </p>
            </div>

            <div className="grid max-w-7xl mx-auto gap-6 lg:grid-cols-3">
              {marketCards.map((card, index) => (
                <motion.div
                  key={card.title}
                  initial={{ opacity: 0, y: 28 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, delay: 0.1 * index }}
                >
                  <div className={`h-full rounded-[2rem] border bg-card/90 px-8 py-10 backdrop-blur-md ${card.borderClassName} ${card.shadowClassName}`}>
                    <p className={`text-2xl md:text-3xl font-semibold tracking-[0.12em] uppercase ${card.accentClassName}`}>
                      {card.title}
                    </p>
                    <div className={`mt-6 text-3xl md:text-4xl font-black tracking-tight ${card.accentClassName}`}>
                      {card.value}
                    </div>
                    <p className="mt-6 text-xl md:text-2xl leading-relaxed text-muted-foreground">
                      {card.description}
                    </p>

                    <div className="mt-8 border-t border-border/60 pt-6">
                      <ul className="space-y-5">
                        {card.bullets.map((bullet) => (
                          <li key={bullet} className="flex items-start gap-3 text-xl leading-relaxed text-foreground/90">
                            <span className={`mt-2.5 h-2.5 w-2.5 shrink-0 rounded-full ${card.dotClassName}`} />
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </Section>

        <Section id="competition" className="bg-transparent" contentClassName="max-w-7xl py-6">
          <div className="space-y-4">
            <div className="text-center space-y-1">
              <h1 className="text-4xl md:text-5xl font-bold text-foreground">Competitive Landscape</h1>
              <p className="max-w-5xl mx-auto text-base md:text-lg text-muted-foreground">
                Dispatch wins by closing the loop from recon to verified remediation inside the developer workflow.
              </p>
            </div>

            <LinesPatternCard className="rounded-[1.5rem] shadow-2xl border-primary/25">
              <LinesPatternCardBody className="p-4 md:p-5">
                <div className="overflow-x-auto">
                  <table className="min-w-[1100px] w-full text-left">
                    <thead>
                      <tr className="border-b border-border/60 text-sm md:text-base text-muted-foreground">
                        <th className="pb-3 pr-4 font-semibold">Tool</th>
                        <th className="pb-3 px-4 font-semibold">Pricing</th>
                        {competitorColumns.map((column) => (
                          <th key={column} className="pb-3 px-3 text-center font-semibold">
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {competitorRows.map((row) => (
                        <tr
                          key={row.tool}
                          className={`border-b border-border/50 ${row.isDispatch ? 'bg-primary/18 ring-1 ring-primary/50' : ''}`}
                        >
                          <td className="py-4 pr-4 align-top">
                            <div className={`${row.isDispatch ? 'text-primary' : 'text-foreground'} text-xl font-bold`}>
                              {row.tool}
                            </div>
                            <div className="text-sm md:text-base text-muted-foreground">
                              {row.description}
                            </div>
                          </td>
                          <td className={`py-4 px-4 align-top text-base md:text-lg font-semibold ${row.isDispatch ? 'text-primary' : 'text-foreground/85'}`}>
                            {row.pricing}
                          </td>
                          {row.features.map((feature, index) => (
                            <td key={`${row.tool}-${competitorColumns[index]}`} className="py-4 px-3 text-center align-top">
                              {feature === 'yes' ? (
                                <span className={`text-3xl leading-none ${row.isDispatch ? 'text-primary' : 'text-[#23c59a]'}`}>✓</span>
                              ) : feature === 'partial' ? (
                                <span className="text-lg font-semibold text-[#d99321]">Partial</span>
                              ) : (
                                <span className="text-3xl leading-none text-muted-foreground/55">×</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-6 text-sm md:text-base">
                  <div className="flex items-center gap-2 text-foreground/90">
                    <span className="text-2xl text-[#23c59a]">✓</span>
                    <span>Yes</span>
                  </div>
                  <div className="flex items-center gap-2 text-foreground/90">
                    <span className="font-semibold text-[#d99321]">Partial</span>
                    <span>Partial</span>
                  </div>
                  <div className="flex items-center gap-2 text-foreground/90">
                    <span className="text-2xl text-muted-foreground/55">×</span>
                    <span>No</span>
                  </div>
                  <div className="font-semibold text-muted-foreground">
                    Gap: nobody else closes the loop from exploit evidence to verified remediation.
                  </div>
                </div>
              </LinesPatternCardBody>
            </LinesPatternCard>

            <div className="grid gap-4 lg:grid-cols-2">
              {forceCards.filter((card) => !card.fullWidth).map((card) => (
                <LinesPatternCard key={card.title} className="rounded-[1.5rem] shadow-xl border-white/10">
                  <LinesPatternCardBody className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-xl md:text-2xl font-bold text-foreground">{card.title}</h3>
                      <span className={`rounded-full px-4 py-1 text-sm md:text-base font-semibold ${card.levelClassName}`}>
                        {card.level}
                      </span>
                    </div>
                    <div className="mt-4 h-3 rounded-full bg-white/12">
                      <div className={`h-3 rounded-full ${card.barClassName} ${card.widthClassName}`} />
                    </div>
                    <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{card.text}</p>
                  </LinesPatternCardBody>
                </LinesPatternCard>
              ))}
            </div>

            {forceCards.filter((card) => card.fullWidth).map((card) => (
              <LinesPatternCard key={card.title} className="rounded-[1.5rem] shadow-2xl border-white/10">
                <LinesPatternCardBody className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-2xl md:text-3xl font-bold text-foreground">{card.title}</h3>
                    <span className={`rounded-full px-4 py-1 text-sm md:text-base font-semibold ${card.levelClassName}`}>
                      {card.level}
                    </span>
                  </div>
                  <div className="mt-4 h-3 rounded-full bg-white/12">
                    <div className={`h-3 rounded-full ${card.barClassName} ${card.widthClassName}`} />
                  </div>
                  <p className="mt-4 text-xl leading-relaxed text-muted-foreground">
                    {card.text}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <span className="rounded-full bg-[#1d3658] px-4 py-2 text-base font-semibold text-[#83b3ff]">Snyk: $25-$40/dev/mo</span>
                    <span className="rounded-full bg-[#1d3658] px-4 py-2 text-base font-semibold text-[#83b3ff]">Semgrep: freemium OSS</span>
                    <span className="rounded-full bg-[#1d3658] px-4 py-2 text-base font-semibold text-[#83b3ff]">GitHub Adv. Security: bundled</span>
                  </div>
                </LinesPatternCardBody>
              </LinesPatternCard>
            ))}
          </div>
        </Section>
      </div>

    </div>
  );
};

export default Index;
