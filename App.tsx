import React, { useState, useMemo } from 'react';
import { QuantizationType } from './types';
import { QUANTIZATION_FACTORS, OVERHEAD_FACTOR } from './constants';

const App: React.FC = () => {
  const [modelSize, setModelSize] = useState<string>('70');
  const [quantization, setQuantization] = useState<QuantizationType>(QuantizationType.FP16);

  const requiredMemory = useMemo(() => {
    const p = parseFloat(modelSize);
    if (isNaN(p) || p <= 0) {
      return null;
    }
    const z = QUANTIZATION_FACTORS[quantization];
    return p * z * OVERHEAD_FACTOR;
  }, [modelSize, quantization]);

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 font-sans text-brand-dark">
      <main className="w-full max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        
        {/* Left Side: Calculator */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-10 flex flex-col space-y-8">
          <div className="text-center lg:text-left">
            <h1 className="text-3xl md:text-4xl font-bold text-brand-dark">GPU Inference Sizer</h1>
            <p className="text-gray-500 mt-2 text-lg">Estimate required GPU memory instantly.</p>
          </div>

          {/* Input: Model Size */}
          <div className="space-y-3">
            <label htmlFor="modelSize" className="text-lg font-semibold text-gray-700">Model Parameters (Billions)</label>
            <div className="relative">
              <input
                id="modelSize"
                type="number"
                value={modelSize}
                onChange={(e) => setModelSize(e.target.value)}
                placeholder="e.g., 70"
                className="w-full text-2xl p-4 pr-16 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-secondary focus:border-transparent transition-shadow"
              />
              <span className="absolute inset-y-0 right-0 flex items-center pr-5 text-xl text-gray-400 font-medium">B</span>
            </div>
          </div>

          {/* Input: Quantization */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-700">Quantization Factor (Z)</h3>
            <div className="grid grid-cols-2 gap-3">
              {Object.values(QuantizationType).map((qType) => (
                <button
                  key={qType}
                  onClick={() => setQuantization(qType)}
                  className={`p-4 text-center rounded-lg font-semibold transition-all duration-200 text-base border-2 ${
                    quantization === qType
                      ? 'bg-brand-primary text-white border-brand-primary shadow-lg'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100 hover:border-gray-300 border-gray-200'
                  }`}
                >
                  {qType}
                  <span className="block text-sm opacity-80">({QUANTIZATION_FACTORS[qType]} Bytes)</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Result and Info */}
        <div className="flex flex-col space-y-8">
          {/* Result Display */}
          <div className="bg-gradient-to-br from-brand-primary to-brand-secondary text-white rounded-2xl shadow-2xl p-6 md:p-10 flex flex-col items-center justify-center text-center h-full min-h-[250px]">
             <h2 className="text-2xl font-medium opacity-80">Required GPU Memory</h2>
             <div className="my-2 text-6xl md:text-7xl font-bold tracking-tight">
               {requiredMemory !== null ? requiredMemory.toFixed(2) : '--'}
               {requiredMemory !== null && <span className="text-4xl ml-2 opacity-80">GB</span>}
             </div>
             <p className="opacity-70 mt-2 max-w-xs">This includes a 20% overhead for loading and processing.</p>
          </div>

          {/* How It Works Section */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h3 className="text-xl font-bold mb-4 text-brand-dark">How It Works (in 3 easy steps!)</h3>
            <div className="space-y-4 text-gray-700">
              <div className="flex items-start">
                <div className="flex-shrink-0 w-8 h-8 bg-brand-secondary text-white rounded-full flex items-center justify-center font-bold text-lg mr-4">1</div>
                <div>
                  <h4 className="font-bold">Enter Model Size</h4>
                  <p className="text-gray-600">Type in how many billions of parameters your model has. If it's a 70B model, just enter 70.</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="flex-shrink-0 w-8 h-8 bg-brand-secondary text-white rounded-full flex items-center justify-center font-bold text-lg mr-4">2</div>
                <div>
                  <h4 className="font-bold">Pick Quantization</h4>
                  <p className="text-gray-600">Click a button to choose the model's format. This is like picking the file size vs. quality. FP16 is a common choice!</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="flex-shrink-0 w-8 h-8 bg-brand-secondary text-white rounded-full flex items-center justify-center font-bold text-lg mr-4">3</div>
                <div>
                  <h4 className="font-bold">Get Your Answer!</h4>
                  <p className="text-gray-600">The big blue box instantly shows you the GPU memory needed. That's it!</p>
                </div>
              </div>
            </div>
          </div>

          {/* Formula and Example */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h3 className="text-xl font-bold mb-3 text-brand-dark">Formula</h3>
            <div className="bg-gray-100 p-4 rounded-lg text-center text-gray-700 font-mono text-lg tracking-wider">
                M = P × Z × 1.2
            </div>
            <div className="mt-4 text-gray-600 space-y-1">
                <p><span className="font-semibold">M</span> = GPU Memory (GB)</p>
                <p><span className="font-semibold">P</span> = Model Parameters (Billions)</p>
                <p><span className="font-semibold">Z</span> = Quantization Factor (Bytes)</p>
            </div>
             <hr className="my-4"/>
             <h3 className="text-xl font-bold mb-3 text-brand-dark">Example</h3>
             <p className="text-gray-600">
                For a 70B model with FP16 quantization:
                <br/>
                <span className="font-mono text-gray-800">70 × 2 × 1.2 = <strong>168.00 GB</strong></span>
             </p>
          </div>
        </div>
      </main>
       <footer className="text-center text-gray-500 mt-12">
         <p>A simple tool for LLM practitioners.</p>
      </footer>
    </div>
  );
};

export default App;