import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface SectionProps {
  id: string;
  children: ReactNode;
  className?: string;
}

export const Section = ({ id, children, className = '' }: SectionProps) => {
  return (
    <section
      id={id}
      className={`min-h-screen w-full flex snap-start ${className}`}
      style={{
        paddingTop: '6rem',
        boxSizing: 'border-box'
      }}
    >
      <div 
        className="w-full flex items-center justify-center"
        style={{ minHeight: 'calc(100vh - 6rem)' }}
      >
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          viewport={{ once: false, amount: 0.3 }}
          className="w-full max-w-6xl mx-auto px-6 py-20"
        >
          {children}
        </motion.div>
      </div>
    </section>
  );
};
