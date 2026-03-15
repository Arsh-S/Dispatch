import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Section } from '@/components/Section';
import { PillBase } from '@/components/ui/3d-adaptive-navigation-bar';
import PaperBackground from '@/components/PaperBackground';
import { LinesPatternCard, LinesPatternCardBody } from '@/components/ui/card-with-lines-pattern';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useLanguage } from '@/contexts/LanguageContext';

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
    priceClassName: 'text-6xl md:text-7xl text-foreground',
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
    priceClassName: 'text-6xl md:text-7xl text-secondary',
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
    priceClassName: 'text-6xl md:text-7xl text-primary',
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
    priceClassName: 'text-5xl md:text-6xl text-accent',
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

const Citation = ({ text, className = '' }: { text: string; className?: string }) => (
  <p className={`mt-4 text-xs leading-relaxed tracking-wide text-muted-foreground/70 ${className}`}>
    {text}
  </p>
);

const Index = () => {
  const { t } = useLanguage();
  const [activeSection, setActiveSection] = useState('home');

  const teamMembers = [
    { name: 'Arsh', detail: 'Team Member', initials: 'A', image: '/arsh.jpeg' },
    { name: 'Mateo', detail: 'Team Member', initials: 'M', image: '/Mateo_Headshot.jpeg' },
    { name: 'Diya', detail: 'Team Member', initials: 'D', image: '/Diya_Headshot.jpeg' },
    { name: 'Jimmy', detail: 'Team Member', initials: 'J', image: '/Jimmy_Headshot.jpeg' },
  ];

  useEffect(() => {
    const handleScroll = () => {
      const sections = ['home', 'problem', 'clinical', 'solution', 'how-it-works', 'dashboard', 'muscle', 'summary', 'business-model', 'market-size'];
      const scrollPosition = window.scrollY + window.innerHeight / 2;

      for (const sectionId of sections) {
        const element = document.getElementById(sectionId);
        if (element) {
          const { offsetTop, offsetHeight } = element;
          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            setActiveSection(sectionId);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);

    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="relative min-h-screen">
      <PaperBackground />

      <div className="fixed top-8 left-1/2 z-50 -translate-x-1/2">
        <PillBase activeSection={activeSection} onSectionClick={scrollToSection} />
      </div>

      <div className="snap-y snap-mandatory h-screen overflow-y-scroll relative">
        <Section id="home" className="bg-transparent">
          <div className="space-y-12">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
              className="text-center space-y-6"
            >
              <h1 className="text-8xl md:text-9xl font-bold text-foreground tracking-tight">
                {t('home.title')}
              </h1>
              <p className="text-2xl md:text-3xl text-muted-foreground font-light max-w-3xl mx-auto">
                {t('home.subtitle')}
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-8 max-w-6xl mx-auto mt-16">
              {teamMembers.map((member, index) => (
                <motion.div
                  key={member.name}
                  initial={{ opacity: 0, y: 50 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.2 + index * 0.15 }}
                >
                  <LinesPatternCard className="rounded-2xl shadow-xl h-80">
                    <LinesPatternCardBody className="h-full flex flex-col items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/5">
                      <div className="text-center space-y-4 p-6 flex flex-col items-center">
                        {member.image ? (
                          <div className="w-32 h-32 rounded-full overflow-hidden border border-primary/20 shadow-sm">
                            <img
                              src={member.image}
                              alt={member.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-32 h-32 rounded-full border border-primary/20 bg-background/80 flex items-center justify-center text-3xl font-bold text-primary shadow-sm">
                            {member.initials}
                          </div>
                        )}
                        <p className="text-lg text-foreground font-semibold">{member.name}</p>
                        <p className="text-sm text-muted-foreground">{member.detail}</p>
                      </div>
                    </LinesPatternCardBody>
                  </LinesPatternCard>
                </motion.div>
              ))}
            </div>
          </div>
        </Section>

        <Section id="problem" className="bg-transparent">
          <div className="space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              viewport={{ once: false, amount: 0.45 }}
              className="max-w-6xl mx-auto text-center space-y-4"
            >
              <h2 className="text-4xl md:text-6xl xl:text-7xl font-black tracking-tight leading-[1.05] text-foreground">
                A pentest finds your vulnerabilities... but it still costs
              </h2>
              <div className="text-6xl md:text-8xl font-black tracking-tight text-destructive">
                $5K-$100K+
              </div>
              <Citation
                text={'(Invicti, 2025).'}
                className="text-center max-w-3xl mx-auto"
              />
            </motion.div>

            <div className="grid max-w-7xl mx-auto gap-6 lg:grid-cols-3">
              {problemCards.map((card, index) => (
                <motion.div
                  key={card.number}
                  initial={{ opacity: 0, y: 32 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, delay: 0.12 * index }}
                  viewport={{ once: false, amount: 0.35 }}
                  className={`h-full rounded-[2rem] border bg-card/90 px-8 py-10 backdrop-blur-md ${card.borderClassName} ${card.shadowClassName}`}
                >
                  <div className={`text-6xl md:text-7xl font-black tracking-tight ${card.numberClassName}`}>
                    {card.number}
                  </div>
                  <p className="mt-6 text-xl md:text-2xl leading-relaxed text-muted-foreground">
                    {card.text}
                  </p>
                  <Citation text={card.citation} />
                </motion.div>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.35 }}
              viewport={{ once: false, amount: 0.35 }}
              className="relative max-w-7xl mx-auto pt-4"
            >
              <div className="rounded-[2rem] border border-primary/20 bg-card/90 px-8 py-10 text-center shadow-[0_30px_90px_rgba(33,117,78,0.22)] backdrop-blur-md">
                <p className="mx-auto max-w-6xl text-2xl font-bold leading-snug text-foreground md:text-4xl">
                  How do we turn security testing into tickets, fixes, and verified PRs instead of yet another PDF?
                </p>
                <Citation
                  text={'(Invicti, 2025; IBM, 2025).'}
                  className="text-center"
                />
              </div>
              <div className="absolute left-1/2 top-full flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-[#183126] text-4xl text-foreground/90 shadow-[0_20px_50px_rgba(0,0,0,0.4)]">
                ↓
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

        <Section id="solution" className="bg-transparent">
          <div className="space-y-8">
            <div className="text-center space-y-4">
              <h1 className="text-5xl md:text-7xl font-bold text-foreground">Dispatch Architecture</h1>
              <p className="text-2xl md:text-3xl text-muted-foreground font-light max-w-4xl mx-auto">
                Security tools give you a PDF. Dispatch gives you a pull request.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {architectureCards.map((card, index) => (
                <motion.div
                  key={card.title}
                  initial={{ opacity: 0, y: 28 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, delay: 0.12 * index }}
                >
                  <LinesPatternCard className={`rounded-2xl shadow-xl h-full ${card.borderClassName}`}>
                    <LinesPatternCardBody className="p-8 text-center">
                      <h3 className={`text-3xl font-bold mb-4 ${card.accentClassName}`}>{card.title}</h3>
                      <p className="text-foreground text-xl leading-relaxed">{card.text}</p>
                      <Citation text={card.citation} className="text-center" />
                    </LinesPatternCardBody>
                  </LinesPatternCard>
                </motion.div>
              ))}
            </div>

            <LinesPatternCard className="max-w-6xl mx-auto rounded-2xl shadow-2xl border-accent/30">
              <LinesPatternCardBody className="text-center p-10">
                <div className="text-4xl md:text-5xl font-bold text-accent mb-4">
                  Triggered from chat, your terminal, or the dashboard
                </div>
                <p className="text-2xl text-foreground font-semibold mb-3">
                  Findings become tracked remediation work. Remediation work becomes validated code changes.
                </p>
                <Citation
                  text={'(Souppaya et al., 2022; OWASP Foundation, 2025).'}
                  className="text-center"
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

        <Section id="dashboard" className="bg-transparent">
          <div className="space-y-8">
            <div className="text-center space-y-4">
              <h1 className="text-5xl md:text-7xl font-bold text-foreground">Outputs Developers Actually Use</h1>
              <p className="max-w-5xl mx-auto text-xl md:text-2xl text-muted-foreground">
                Dispatch is designed around operational outputs developers can act on immediately, not another dead-end report.
              </p>
            </div>

            <div className="grid gap-6 max-w-7xl mx-auto md:grid-cols-2">
              {outputCards.map((card, index) => (
                <motion.div
                  key={card.title}
                  initial={{ opacity: 0, y: 28 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, delay: 0.1 * index }}
                >
                  <LinesPatternCard className={`rounded-2xl shadow-xl h-full ${card.borderClassName}`}>
                    <LinesPatternCardBody className="p-8">
                      <h3 className={`text-3xl font-bold mb-4 ${card.accentClassName}`}>{card.title}</h3>
                      <p className="text-foreground text-xl leading-relaxed">{card.text}</p>
                      <Citation text={card.citation} />
                    </LinesPatternCardBody>
                  </LinesPatternCard>
                </motion.div>
              ))}
            </div>

            <LinesPatternCard className="max-w-6xl mx-auto rounded-2xl shadow-2xl border-secondary/30">
              <LinesPatternCardBody className="p-8 text-center">
                <p className="text-2xl md:text-3xl font-semibold text-foreground leading-snug">
                  The barrier to running a security test drops to zero: no separate workflow, no manual triage spreadsheet, just the tools the team already uses.
                </p>
                <Citation
                  text={'(Souppaya et al., 2022).'}
                  className="text-center"
                />
              </LinesPatternCardBody>
            </LinesPatternCard>
          </div>
        </Section>

        <Section id="muscle" className="bg-transparent">
          <div className="space-y-8">
            <div className="text-center space-y-4">
              <h1 className="text-5xl md:text-7xl font-bold text-foreground">GitHub Issue = The Contract</h1>
              <p className="max-w-5xl mx-auto text-xl md:text-2xl text-muted-foreground">
                Dispatch keeps the fix loop explicit by making the issue itself the machine-readable handoff between pentesting and remediation.
              </p>
            </div>

            <div className="grid gap-6 max-w-7xl mx-auto md:grid-cols-3">
              {fixLoopCards.map((card, index) => (
                <motion.div
                  key={card.title}
                  initial={{ opacity: 0, y: 28 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, delay: 0.1 * index }}
                >
                  <LinesPatternCard className={`rounded-2xl shadow-xl h-full ${card.borderClassName}`}>
                    <LinesPatternCardBody className="p-8">
                      <p className={`text-sm font-semibold tracking-[0.18em] uppercase ${card.accentClassName}`}>{card.badge}</p>
                      <h3 className="mt-4 text-3xl font-bold text-foreground">{card.title}</h3>
                      <p className="mt-5 text-xl leading-relaxed text-muted-foreground">{card.text}</p>
                      <Citation text={card.citation} />
                    </LinesPatternCardBody>
                  </LinesPatternCard>
                </motion.div>
              ))}
            </div>

            <LinesPatternCard className="max-w-6xl mx-auto rounded-2xl shadow-2xl border-accent/30">
              <LinesPatternCardBody className="p-8">
                <p className="text-2xl md:text-3xl font-semibold text-foreground leading-snug text-center">
                  The issue body carries metadata, reproduction steps, server logs, monkeypatch diff, RULES.md violations, and the recommended fix. The issue thread becomes the audit trail: finding, fix attempt, and PR all live in one place.
                </p>
                <Citation
                  text={'(OWASP Foundation, 2025; Scarfone et al., 2008).'}
                  className="text-center"
                />
              </LinesPatternCardBody>
            </LinesPatternCard>
          </div>
        </Section>

        <Section id="summary" className="bg-transparent">
          <div className="space-y-8">
            <div className="text-center space-y-4">
              <h1 className="text-5xl md:text-7xl font-bold text-foreground">Why Dispatch Stands Out</h1>
              <p className="max-w-5xl mx-auto text-xl md:text-2xl text-muted-foreground">
                Dispatch is not just another scanner. It is a developer-native remediation workflow built on top of code-aware security testing.
              </p>
            </div>

            <div className="grid gap-6 max-w-7xl mx-auto md:grid-cols-3">
              {summaryCards.map((card, index) => (
                <motion.div
                  key={card.title}
                  initial={{ opacity: 0, y: 28 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, delay: 0.1 * index }}
                >
                  <LinesPatternCard className={`rounded-2xl shadow-xl h-full ${card.borderClassName}`}>
                    <LinesPatternCardBody className="p-8">
                      <h3 className={`text-3xl font-bold mb-4 ${card.accentClassName}`}>{card.title}</h3>
                      <p className="text-foreground text-xl leading-relaxed">{card.text}</p>
                      <Citation text={card.citation} />
                    </LinesPatternCardBody>
                  </LinesPatternCard>
                </motion.div>
              ))}
            </div>

            <LinesPatternCard className="max-w-6xl mx-auto rounded-2xl shadow-2xl border-primary/30">
              <LinesPatternCardBody className="p-10 text-center">
                <p className="text-3xl md:text-5xl font-bold text-foreground leading-tight">
                  Security tools give you a PDF. Dispatch gives you a pull request.
                </p>
                <p className="mt-5 text-xl md:text-2xl text-muted-foreground max-w-4xl mx-auto leading-relaxed">
                  The next step is obvious: run this on every push, prioritize by real-world runtime risk, and keep the fix loop inside the developer workflow from start to finish.
                </p>
                <Citation
                  text={'(Souppaya et al., 2022; Lewis et al., 2020).'}
                  className="text-center"
                />
              </LinesPatternCardBody>
            </LinesPatternCard>
          </div>
        </Section>

        <Section id="business-model" className="bg-transparent">
          <div className="space-y-8">
            <div className="text-center space-y-4">
              <h1 className="text-5xl md:text-7xl font-bold text-foreground">Dispatch Business Model</h1>
              <p className="max-w-5xl mx-auto text-xl md:text-2xl text-muted-foreground">
                Self-serve pricing for developers, expansion revenue from teams, and enterprise upsell when compliance and sign-off matter.
              </p>
              <Citation
                text={'(Snyk, 2026; Semgrep, 2026; Detectify, 2026).'}
                className="text-center"
              />
            </div>

            <div className="grid max-w-7xl mx-auto gap-6 md:grid-cols-2 xl:grid-cols-4">
              {businessTiers.map((tier, index) => (
                <motion.div
                  key={tier.name}
                  initial={{ opacity: 0, y: 28 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, delay: 0.08 * index }}
                  className="relative"
                >
                  {tier.badge ? (
                    <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-[0_18px_40px_rgba(62,207,142,0.25)]">
                      {tier.badge}
                    </div>
                  ) : null}
                  <div className={`h-full rounded-[2rem] border bg-card/90 px-8 py-10 backdrop-blur-md ${tier.borderClassName} ${tier.shadowClassName}`}>
                    <p className="text-3xl font-bold text-foreground">{tier.name}</p>
                    <div className="mt-6 flex items-end gap-2">
                      <span className={`font-black tracking-tight ${tier.priceClassName}`}>{tier.price}</span>
                      {tier.period ? (
                        <span className="pb-2 text-3xl font-semibold text-muted-foreground">{tier.period}</span>
                      ) : null}
                    </div>
                    <p className="mt-3 text-xl leading-relaxed text-muted-foreground">{tier.subtitle}</p>

                    <div className="mt-8 border-t border-border/60 pt-6">
                      <ul className="space-y-4">
                        {tier.features.map((feature) => (
                          <li key={feature} className="flex items-start gap-3 text-lg md:text-xl">
                            <span className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${tier.dotClassName}`} />
                            <span className="text-foreground/90">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="grid max-w-7xl mx-auto gap-6 lg:grid-cols-2">
              <LinesPatternCard className="rounded-[2rem] shadow-2xl border-primary/25">
                <LinesPatternCardBody className="p-8">
                  <h3 className="text-3xl md:text-4xl font-bold text-foreground mb-8">How Dispatch makes money</h3>
                  <div className="space-y-4">
                    {businessModelRows.map((row) => (
                      <div
                        key={row.label}
                        className="flex flex-col gap-2 border-b border-border/60 pb-4 md:flex-row md:items-center md:justify-between"
                      >
                        <span className="text-xl md:text-2xl text-muted-foreground">{row.label}</span>
                        <span className="text-xl md:text-2xl font-semibold text-foreground md:text-right">{row.value}</span>
                      </div>
                    ))}
                  </div>
                </LinesPatternCardBody>
              </LinesPatternCard>

              <LinesPatternCard className="rounded-[2rem] shadow-2xl border-secondary/30">
                <LinesPatternCardBody className="p-8">
                  <h3 className="text-3xl md:text-4xl font-bold text-foreground mb-8">Upgrade triggers and market anchors</h3>
                  <div className="space-y-4">
                    {upgradeRows.map((row) => (
                      <div
                        key={row.label}
                        className="flex flex-col gap-2 border-b border-border/60 pb-4 md:flex-row md:items-center md:justify-between"
                      >
                        <span className="text-xl md:text-2xl text-muted-foreground">{row.label}</span>
                        {row.isBadge ? (
                          <span className="inline-flex items-center rounded-full bg-primary/15 px-4 py-2 text-lg font-semibold text-primary md:text-xl">
                            {row.value}
                          </span>
                        ) : (
                          <span className="text-xl md:text-2xl font-semibold text-foreground md:text-right">{row.value}</span>
                        )}
                      </div>
                    ))}
                  </div>
                  <Citation
                    text={'(Snyk, 2026; Semgrep, 2026; Detectify, 2026; Vanta, 2026).'}
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
                    <div className={`mt-6 text-6xl md:text-7xl font-black tracking-tight ${card.accentClassName}`}>
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
      </div>

      <LanguageSwitcher />
    </div>
  );
};

export default Index;
