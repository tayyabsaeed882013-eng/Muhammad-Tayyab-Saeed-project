import React, { useState } from 'react';
import { 
  Brain, 
  Moon, 
  Coffee, 
  Zap, 
  Activity, 
  Heart,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import NewAnalysisModal from '../components/NewAnalysisModal';

interface DiseaseInfo {
  id: string;
  name: string;
  icon: React.ComponentType<any>;
  color: string;
  bgColor: string;
  description: string;
  symptoms: string[];
  prevalence: string;
}

const NewAnalysis: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const [selectedDisease, setSelectedDisease] = useState<DiseaseInfo | null>(null);

  const diseases: DiseaseInfo[] = [
    {
      id: 'healthy',
      name: 'Healthy',
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50 border-green-200',
      description: 'Normal sleep patterns with no detected disorders',
      symptoms: ['Regular sleep cycles', 'No abnormal brain activity', 'Restorative sleep'],
      prevalence: 'Ideal state'
    },
    {
      id: 'insomnia',
      name: 'Insomnia',
      icon: Moon,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 border-blue-200',
      description: 'Difficulty falling asleep, staying asleep, or both',
      symptoms: ['Difficulty falling asleep', 'Frequent awakenings', 'Early morning awakening', 'Non-restorative sleep'],
      prevalence: '10-30% of adults'
    },
    {
      id: 'narcolepsy',
      name: 'Narcolepsy',
      icon: Coffee,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50 border-purple-200',
      description: 'Chronic sleep disorder characterized by overwhelming daytime drowsiness',
      symptoms: ['Excessive daytime sleepiness', 'Sudden loss of muscle tone', 'Sleep paralysis', 'Hallucinations'],
      prevalence: '1 in 2,000 people'
    },
    {
      id: 'nfle',
      name: 'NFLE',
      icon: Zap,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50 border-yellow-200',
      description: 'Nocturnal Frontal Lobe Epilepsy - seizures during sleep',
      symptoms: ['Nocturnal seizures', 'Brief motor episodes', 'Altered consciousness', 'Sleep disruption'],
      prevalence: 'Rare form of epilepsy'
    },
    {
      id: 'plm',
      name: 'PLM',
      icon: Activity,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50 border-orange-200',
      description: 'Periodic Limb Movement disorder - repetitive limb movements during sleep',
      symptoms: ['Repetitive leg movements', 'Sleep fragmentation', 'Daytime fatigue', 'Restless sleep'],
      prevalence: '4-11% of adults'
    },
    {
      id: 'rbd',
      name: 'RBD',
      icon: Brain,
      color: 'text-red-600',
      bgColor: 'bg-red-50 border-red-200',
      description: 'REM Sleep Behavior Disorder - acting out dreams',
      symptoms: ['Acting out dreams', 'Violent movements', 'Talking during sleep', 'Injury risk'],
      prevalence: '0.38-0.5% of adults'
    }
  ];

  const handleDiseaseSelect = (disease: DiseaseInfo) => {
    setSelectedDisease(disease);
    setShowModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">New Analysis</h1>
        <p className="mt-2 text-lg text-gray-600">
          Select a condition to learn more and start EEG analysis
        </p>
      </div>

      {/* Disease Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {diseases.map((disease) => {
          const IconComponent = disease.icon;
          return (
            <div
              key={disease.id}
              onClick={() => handleDiseaseSelect(disease)}
              className={`${disease.bgColor} border-2 rounded-xl p-6 cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-105 transform`}
            >
              <div className="flex items-center mb-4">
                <div className={`p-3 rounded-full ${disease.color} bg-white`}>
                  <IconComponent className="h-8 w-8" />
                </div>
                <h3 className="ml-4 text-xl font-semibold text-gray-900">
                  {disease.name}
                </h3>
              </div>
              
              <p className="text-gray-700 mb-4">
                {disease.description}
              </p>
              
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900">Key Symptoms:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  {disease.symptoms.slice(0, 3).map((symptom, index) => (
                    <li key={index} className="flex items-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-400 mr-2"></div>
                      {symptom}
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  Prevalence: {disease.prevalence}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Information Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-start">
          <AlertCircle className="h-6 w-6 text-blue-600 mt-1 mr-3 flex-shrink-0" />
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              About EEG Analysis
            </h3>
            <div className="text-gray-700 space-y-2">
              <p>
                Our advanced machine learning model analyzes EEG data to detect various sleep disorders 
                and neurological conditions. The analysis considers multiple factors including:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Brain wave patterns and frequencies</li>
                <li>Sleep stage transitions</li>
                <li>Abnormal electrical activity</li>
                <li>Patient age and demographic factors</li>
              </ul>
              <p className="mt-4 text-sm text-gray-600">
                <strong>Note:</strong> EEG analysis is only available for patients aged 7 and above. 
                Results should be interpreted by qualified medical professionals.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      <NewAnalysisModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setSelectedDisease(null);
        }}
        disease={selectedDisease}
      />
    </div>
  );
};

export default NewAnalysis;