import { useState, useEffect, useRef } from 'react';
import { PillBase } from '@/components/ui/3d-adaptive-navigation-bar';
import { Section } from '@/components/Section';
import { motion, AnimatePresence } from 'framer-motion';
import PaperBackground from '@/components/PaperBackground';
import { LinesPatternCard, LinesPatternCardBody } from '@/components/ui/card-with-lines-pattern';
import RealtimeVisualization from '@/components/RealtimeVisualization';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useLanguage } from '@/contexts/LanguageContext';

const useTypingEffect = (text: string, speed: number = 40, isActive: boolean = true) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!isActive) {
      setDisplayedText('');
      setIsComplete(false);
      return;
    }

    let index = 0;
    let timer: NodeJS.Timeout;
    
    setDisplayedText('');
    setIsComplete(false);

    const typeNextChar = () => {
      if (index < text.length) {
        setDisplayedText(text.slice(0, index + 1));
        
        const nextChars = text.slice(index, index + 1);
        let delay = speed;
        
        if (nextChars === '…' || text.slice(index - 1, index) === 'b') {
          delay = 800;
        }
        
        index++;
        timer = setTimeout(typeNextChar, delay);
      } else {
        setIsComplete(true);
      }
    };

    const startDelay = setTimeout(() => {
      typeNextChar();
    }, 300);

    return () => {
      clearTimeout(startDelay);
      if (timer) clearTimeout(timer);
    };
  }, [text, speed, isActive]);

  return { displayedText, isComplete };
};

const Index = () => {
  const { t, language } = useLanguage();
  const [activeSection, setActiveSection] = useState('home');
  const [isProblemVisible, setIsProblemVisible] = useState(false);
  const teamMembers = [
    { name: 'Arsh', detail: 'Team Member', initials: 'A', image: '/arsh.jpeg' },
    { name: 'Mateo', detail: 'Team Member', initials: 'M', image: '/Mateo_Headshot.jpeg' },
    { name: 'Diya', detail: 'Team Member', initials: 'D', image: '/Diya_Headshot.jpeg' },
    { name: 'Jimmy', detail: 'Team Member', initials: 'J', image: '/Jimmy_Headshot.jpeg' },
  ];
  const problemText = t('problem.text');
  const { displayedText, isComplete } = useTypingEffect(
    problemText, 
    60, 
    isProblemVisible
  );

  const priceIndex = problemText.indexOf('$60,000');
  const priceFullyTyped = displayedText.length >= priceIndex + '$60,000'.length;

  const renderTextWithHighlight = (text: string) => {
    const parts = text.split('$60,000');
    if (parts.length === 1) {
      return <span>{text}</span>;
    }
    return (
      <>
        <span>{parts[0].trimEnd()}</span>
        {'\u2009'}
        {priceFullyTyped ? (
          <motion.span
            initial={{ scale: 1, opacity: 1 }}
            animate={{ scale: 1.4, opacity: 1 }}
            transition={{ 
              duration: 0.8, 
              ease: [0.22, 1, 0.36, 1],
              delay: 0.1 
            }}
            className="text-destructive inline-block"
            style={{ 
              fontWeight: 800,
              textShadow: '0 0 20px rgba(239, 68, 68, 0.5)',
              transformOrigin: 'left center',
              position: 'relative',
              marginLeft: '0rem',
              marginRight: '1.5rem'
            }}
          >
            $60,000
          </motion.span>
        ) : (
          <span className="mx-1">$60,000</span>
        )}
        <span>{parts[1]}</span>
      </>
    );
  };

  useEffect(() => {
    const handleScroll = () => {
      const sections = ['home', 'problem', 'clinical', 'solution', 'how-it-works', 'dashboard', 'muscle', 'summary'];
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

  // Reset typing effect when language changes
  useEffect(() => {
    setIsProblemVisible(false);
    const timer = setTimeout(() => {
      const problemSection = document.getElementById('problem');
      if (problemSection) {
        const rect = problemSection.getBoundingClientRect();
        const isVisible = rect.top < window.innerHeight * 0.7 && rect.bottom > 0;
        if (isVisible) {
          setIsProblemVisible(true);
        }
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [language]);

  // Intersection Observer for problem section typing effect
  useEffect(() => {
    const problemSection = document.getElementById('problem');
    if (!problemSection) return;

    // Check if already visible on mount
    const rect = problemSection.getBoundingClientRect();
    const isVisible = rect.top < window.innerHeight * 0.7 && rect.bottom > 0;
    if (isVisible) {
      setIsProblemVisible(true);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsProblemVisible(true);
          }
        });
      },
      { threshold: 0.3 }
    );

    observer.observe(problemSection);
    return () => observer.disconnect();
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
      {/* Paper Design Shader Background */}
      <PaperBackground />

      {/* Fixed Navigation */}
      <div className="fixed top-8 left-1/2 -translate-x-1/2 z-50">
        <PillBase activeSection={activeSection} onSectionClick={scrollToSection} />
      </div>

      {/* Sections Container with Snap Scrolling */}
      <div className="snap-y snap-mandatory h-screen overflow-y-scroll relative">{/* Keep existing sections */}
        
        {/* SLIDE 0: Title - Kinetiq */}
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

            {/* Team Cards */}
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
        
        {/* SLIDE 1: Problem + Equity Angle */}
        <Section id="problem" className="bg-transparent">
          <div className="space-y-4">
            {/* <div className="flex items-center gap-4 justify-center mb-4">
              <h1 className="text-6xl md:text-7xl font-bold text-foreground">{t('problem.title')}</h1>
            </div> */}
            
            <div className="max-w-7xl mx-auto">
              {/* Biodex System Image - Hidden when cards appear */}
              <AnimatePresence>
                {!isComplete && (
                  <motion.div
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="max-w-md mx-auto mb-0"
                  >
                    <img 
                      src="/biodex-system.png" 
                      alt="Biodex System 3 Dynamometer" 
                      className="w-full h-auto rounded-lg shadow-xl"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
              
              {/* Typing effect text */}
              <div className="text-center space-y-4 min-h-[180px] flex items-center justify-center px-4 -mt-4">
                <div className="text-3xl md:text-5xl font-semibold text-foreground w-full leading-relaxed">
                  {renderTextWithHighlight(displayedText || '\u00A0')}
                  {!isComplete && <span className="inline-block animate-pulse ml-1">|</span>}
                </div>
              </div>

              {/* Cards appear after typing completes */}
              <AnimatePresence>
                {isComplete && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5 }}
                    className="space-y-4"
                  >
                    <div className="grid md:grid-cols-3 gap-6 mt-6">
                      <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                      >
                        <LinesPatternCard className="rounded-2xl shadow-xl border-destructive/30 h-full">
                          <LinesPatternCardBody>
                            <div className="text-5xl font-bold text-destructive mb-4">{t('problem.stat1.number')}</div>
                            <p className="text-muted-foreground text-lg">
                              {t('problem.stat1.text')}
                            </p>
                          </LinesPatternCardBody>
                        </LinesPatternCard>
                      </motion.div>
              
                      <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.4 }}
                      >
                        <LinesPatternCard className="rounded-2xl shadow-xl border-primary/30 h-full">
                          <LinesPatternCardBody>
                            <div className="text-5xl font-bold text-primary mb-4">{t('problem.stat2.number')}</div>
                            <p className="text-muted-foreground text-lg">
                              {t('problem.stat2.text')}
                            </p>
                          </LinesPatternCardBody>
                        </LinesPatternCard>
                      </motion.div>

                      <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.6 }}
                      >
                        <LinesPatternCard className="rounded-2xl shadow-xl border-accent/30 h-full">
                          <LinesPatternCardBody>
                            <div className="text-5xl font-bold text-accent mb-4">{t('problem.stat3.number')}</div>
                            <p className="text-muted-foreground text-lg">
                              {t('problem.stat3.text')}
                            </p>
                          </LinesPatternCardBody>
                        </LinesPatternCard>
                      </motion.div>
                    </div>

                    <motion.div
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.8 }}
                    >
                      <LinesPatternCard className="mt-6 rounded-2xl border-primary/30">
                        <LinesPatternCardBody className="text-center">
                          <p className="text-2xl font-semibold text-foreground">
                            {t('problem.question')}
                          </p>
                        </LinesPatternCardBody>
                      </LinesPatternCard>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </Section>

        {/* SLIDE 2: Clinical Insight */}
        <Section id="clinical" className="bg-transparent">
          <div className="space-y-8">
            <div className="flex items-center gap-4 justify-center mb-8">
              <h1 className="text-6xl md:text-7xl font-bold text-foreground">{t('clinical.title')}</h1>
            </div>
            
            <div className="max-w-6xl mx-auto space-y-6">
              <LinesPatternCard className="rounded-2xl shadow-xl border-primary/40 w-full">
                <LinesPatternCardBody className="p-8">
                  <p className="text-foreground text-2xl leading-relaxed">
                    {t('clinical.text1')}
                  </p>
                </LinesPatternCardBody>
              </LinesPatternCard>

              <LinesPatternCard className="rounded-2xl shadow-xl border-secondary/40 w-full">
                <LinesPatternCardBody className="p-8">
                  <p className="text-foreground text-2xl leading-relaxed">
                    {t('clinical.text3')}
                  </p>
                </LinesPatternCardBody>
              </LinesPatternCard>

              <LinesPatternCard className="rounded-2xl shadow-xl border-accent/40 w-full">
                <LinesPatternCardBody className="p-8">
                  <p className="text-foreground text-2xl leading-relaxed">
                    {t('clinical.text4')}
                  </p>
                </LinesPatternCardBody>
              </LinesPatternCard>
            </div>
          </div>
        </Section>

        {/* SLIDE 3: The Solution */}
        <Section id="solution" className="bg-transparent">
          <div className="space-y-8">
            <div className="flex items-center gap-4 justify-center mb-8">
              <h1 className="text-6xl md:text-7xl font-bold text-foreground">{t('solution.title')}</h1>
            </div>
            
            <div className="max-w-5xl mx-auto space-y-10">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                whileInView={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.6 }}
                className="text-center space-y-4"
              >
                <h2 className="text-6xl md:text-7xl font-bold text-foreground">
                  {t('solution.subtitle')}
                </h2>
                <p className="text-2xl text-muted-foreground">{t('solution.description')}</p>
              </motion.div>

              <div className="grid md:grid-cols-3 gap-6">
                <LinesPatternCard className="rounded-2xl shadow-xl border-primary/30 h-full">
                  <LinesPatternCardBody className="text-center p-6">
                    <h3 className="text-2xl font-bold text-primary mb-4">{t('solution.sensor1.title')}</h3>
                    <p className="text-foreground text-lg">{t('solution.sensor1.desc')}</p>
                  </LinesPatternCardBody>
                </LinesPatternCard>

                <LinesPatternCard className="rounded-2xl shadow-xl border-secondary/30 h-full">
                  <LinesPatternCardBody className="text-center p-6">
                    <h3 className="text-2xl font-bold text-secondary mb-4">{t('solution.sensor2.title')}</h3>
                    <p className="text-foreground text-lg">{t('solution.sensor2.desc')}</p>
                  </LinesPatternCardBody>
                </LinesPatternCard>

                <LinesPatternCard className="rounded-2xl shadow-xl border-accent/30 h-full">
                  <LinesPatternCardBody className="text-center p-6">
                    <h3 className="text-2xl font-bold text-accent mb-4">{t('solution.sensor3.title')}</h3>
                    <p className="text-foreground text-lg">{t('solution.sensor3.desc')}</p>
                  </LinesPatternCardBody>
                </LinesPatternCard>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <LinesPatternCard className="rounded-2xl shadow-2xl border-accent/40">
                  <LinesPatternCardBody className="text-center p-10">
                    <div className="text-7xl font-bold text-accent mb-4">{t('solution.price')}</div>
                    <p className="text-3xl text-foreground font-semibold mb-4">{t('solution.bom')}</p>
                    <p className="text-xl text-muted-foreground leading-relaxed max-w-3xl mx-auto">
                      {t('solution.accessibility')}
                    </p>
                  </LinesPatternCardBody>
                </LinesPatternCard>
              </motion.div>
            </div>
          </div>
        </Section>

        {/* SLIDE 4: How It Works */}
        <Section id="how-it-works" className="bg-transparent">
          <div className="space-y-8">
            <div className="flex items-center gap-4 justify-center mb-8">
              <h1 className="text-6xl md:text-7xl font-bold text-foreground">{t('howitworks.title')}</h1>
            </div>
            
            <div className="max-w-5xl mx-auto space-y-10">
              {/* Timeline */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="flex items-center justify-center gap-3"
              >
                <LinesPatternCard className="rounded-lg shadow-lg border-primary/30">
                  <LinesPatternCardBody className="px-3 py-2 text-center h-16 flex items-center justify-center">
                    <p className="text-xl font-semibold text-foreground whitespace-nowrap">{t('howitworks.step1')}</p>
                  </LinesPatternCardBody>
                </LinesPatternCard>
                
                <div className="text-2xl text-primary font-bold">→</div>
                
                <LinesPatternCard className="rounded-lg shadow-lg border-secondary/30">
                  <LinesPatternCardBody className="px-3 py-2 text-center h-16 flex items-center justify-center">
                    <p className="text-xl font-semibold text-foreground">{t('howitworks.step2')}</p>
                  </LinesPatternCardBody>
                </LinesPatternCard>
                
                <div className="text-2xl text-secondary font-bold">→</div>
                
                <LinesPatternCard className="rounded-lg shadow-lg border-accent/30">
                  <LinesPatternCardBody className="px-3 py-2 text-center h-16 flex items-center justify-center">
                    <p className="text-xl font-semibold text-foreground">{t('howitworks.step3')}</p>
                  </LinesPatternCardBody>
                </LinesPatternCard>
                
                <div className="text-2xl text-accent font-bold">→</div>
                
                <LinesPatternCard className="rounded-lg shadow-lg border-destructive/30">
                  <LinesPatternCardBody className="px-3 py-2 text-center h-16 flex items-center justify-center">
                    <p className="text-xl font-semibold text-foreground">{t('howitworks.step4')}</p>
                  </LinesPatternCardBody>
                </LinesPatternCard>
              </motion.div>

              {/* Outputs Section */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <LinesPatternCard className="rounded-2xl shadow-2xl border-primary/40">
                  <LinesPatternCardBody className="p-8">
                    <h3 className="text-3xl font-bold text-foreground mb-8 text-center">{t('howitworks.outputs')}</h3>
                    <div className="grid md:grid-cols-3 gap-6">
                      <div className="text-center p-6 rounded-xl bg-primary/10 border border-primary/30">
                        <p className="text-xl font-semibold text-primary">{t('howitworks.output1')}</p>
                      </div>
                      <div className="text-center p-6 rounded-xl bg-secondary/10 border border-secondary/30">
                        <p className="text-xl font-semibold text-secondary">{t('howitworks.output2')}</p>
                      </div>
                      <div className="text-center p-6 rounded-xl bg-accent/10 border border-accent/30">
                        <p className="text-xl font-semibold text-accent">{t('howitworks.output3')}</p>
                      </div>
                    </div>
                  </LinesPatternCardBody>
                </LinesPatternCard>
              </motion.div>
            </div>
          </div>
        </Section>

        {/* SLIDE 5: Live Dashboard Demo */}
        <Section id="dashboard" className="bg-transparent">
          <div className="space-y-8">
            <div className="flex items-center gap-4 justify-center mb-8">
              <h1 className="text-6xl md:text-7xl font-bold text-foreground">{t('dashboard.title')}</h1>
            </div>
            
            <div className="max-w-6xl mx-auto">
              <RealtimeVisualization />
            </div>
          </div>
        </Section>

        {/* SLIDE 6: Muscle Activation */}
        <Section id="muscle" className="bg-transparent">
          <div className="space-y-4">
            <div className="flex items-center gap-4 justify-center mb-12">
              <h1 className="text-6xl md:text-7xl font-bold text-foreground mb-10">{t('muscle.title')}</h1>
            </div>
            
            <div className="w-full px-2">
              <div className="grid md:grid-cols-2 gap-56">
                <div className="w-full -ml-2 flex items-center justify-center">
                  <div style={{ maxHeight: '600px', width: '100%' }} className="w-full flex items-center justify-center">
                    <img 
                      src="/data/emg_left_graph.png" 
                      alt="EMG Left Graph" 
                      className="max-w-full h-auto rounded-2xl shadow-2xl object-contain scale-[1.45]"
                    />
                  </div>
                </div>
                <div className="w-full -mr-2 flex items-center justify-center">
                  <div style={{ maxHeight: '600px', width: '100%' }} className="w-full flex items-center justify-center">
                    <img 
                      src="/data/emg_right_graph.png" 
                      alt="EMG Right Graph" 
                      className="max-w-full h-auto rounded-2xl shadow-2xl object-contain scale-[1.45]"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="max-w-5xl mx-auto mt-16 space-y-8">
              {/* <LinesPatternCard className="rounded-2xl shadow-2xl border-accent/30">
                <LinesPatternCardBody>
                  <h2 className="text-2xl font-semibold text-foreground mb-6 text-center">
                    {t('muscle.curves')}
                  </h2>
                  <div className="grid md:grid-cols-3 gap-6">
                    <div className="h-24 flex flex-col items-center justify-center">
                      <p className="text-lg text-foreground font-semibold">{t('muscle.quad')}</p>
                    </div>
                    <div className="h-24 flex flex-col items-center justify-center">
                      <p className="text-lg text-foreground font-semibold">{t('muscle.hamstring')}</p>
                    </div>
                    <div className="h-24 flex flex-col items-center justify-center">
                      <p className="text-lg text-foreground font-semibold">{t('muscle.gastro')}</p>
                    </div>
                  </div>
                  <p className="text-center text-muted-foreground mt-6 text-sm">
                    {t('muscle.monitor')}
                  </p>
                </LinesPatternCardBody>
              </LinesPatternCard> */}
            </div>
          </div>
        {/* <div className="max-w-5xl mx-auto mt-40">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-8 bg-destructive/10 rounded-2xl border border-destructive/30"
          >
            <p className="text-xl text-foreground leading-relaxed">
              <strong>{t('muscle.finding')}</strong> {t('muscle.finding.text')}
            </p>
          </motion.div>
        </div> */}
        </Section>

        {/* SLIDE 7: Recovery Summary */}
        <Section id="summary" className="bg-transparent">
          <div className="space-y-8 -mt-8">
            <div className="flex items-center gap-4 justify-center">
              <h1 className="text-5xl md:text-7xl font-bold text-foreground">{t('summary.title')}</h1>
            </div>
            
            <div className="max-w-5xl mx-auto space-y-10">
              <LinesPatternCard className="rounded-2xl shadow-2xl">
                <LinesPatternCardBody>
                  <div className="w-full flex justify-center">
                    <img 
                      src="/knee_torque_analysis_dark.png" 
                      alt="Knee Torque Analysis" 
                      className="w-full h-auto rounded-lg"
                    />
                  </div>
                </LinesPatternCardBody>
              </LinesPatternCard>
            </div>
          </div>
        </Section>

      </div>

      {/* Language Switcher */}
      <LanguageSwitcher />
    </div>
  );
};

export default Index;
