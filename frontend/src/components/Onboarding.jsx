import React, { useState } from 'react';
import { PageTransition } from './PageTransition';

const steps = [
  {
    id: 'welcome',
    title: 'Welcome to Thalya',
    description: 'Let\'s setup your AI assistant'
  },
  {
    id: 'business',
    title: 'Business Details',
    fields: ['name', 'type', 'hours']
  },
  {
    id: 'persona',
    title: 'AI Persona',
    fields: ['tone', 'language']
  }
];

export const Onboarding = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({});

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(curr => curr + 1);
    } else {
      // Submit final data
    }
  };

  return (
    <PageTransition>
      <div className="max-w-2xl mx-auto">
        <div className="space-y-6">
          <h2 className="text-2xl font-bold">{steps[currentStep].title}</h2>
          {/* Step content here */}
          <button 
            onClick={handleNext}
            className="px-4 py-2 bg-blue-600 rounded-lg"
          >
            {currentStep === steps.length - 1 ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </PageTransition>
  );
};
