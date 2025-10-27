
import React, { useState, useMemo, useCallback } from 'react';
import { QuantizationType, UseCaseType, Model, Scenario } from './types';
import { QUANTIZATION_FACTORS, OVERHEAD_FACTOR, HOURS_IN_MONTH } from './constants';
import { GPU, GPUS } from './gpus';
import { MODELS } from './models';
import { API_PRICING } from './apiPricing';

interface GpuSuggestion extends GPU {
  count: number;
}

const App: React.FC = () => {
  // --- STATE MANAGEMENT ---
  const [useCase, setUseCase] = useState<UseCaseType>(UseCaseType.CHAT_CONVERSATION);
  const [modelName, setModelName] = useState<string>(MODELS.filter(m => m.useCase === UseCaseType.CHAT_CONVERSATION)[0]?.name || '');
  const [modelSize, setModelSize] = useState<string>(String(MODELS.filter(m => m.useCase === UseCaseType.CHAT_CONVERSATION)[0]?.params || '70'));
  const [quantization, setQuantization] = useState<QuantizationType>(MODELS.filter(m => m.useCase === UseCaseType.CHAT_CONVERSATION)[0]?.quantization || QuantizationType.FP16);
  
  // Sales Engineer specific state
  const [batchSize, setBatchSize] = useState('8');
  const [sequenceLength, setSequenceLength] = useState('2048');
  const [requestsPerMonth, setRequestsPerMonth] = useState('1000000');
  const [avgTokensPerRequest, setAvgTokensPerRequest] = useState('3000');
  const [selectedApi, setSelectedApi] = useState(API_PRICING[0].name);

  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [activeTab, setActiveTab] = useState('summary');
  const [isCopied, setIsCopied] = useState(false);

  // --- DERIVED STATE & CALCULATIONS ---

  const requiredMemory = useMemo(() => {
    const p = parseFloat(modelSize);
    if (isNaN(p) || p <= 0) return null;
    const z = QUANTIZATION_FACTORS[quantization];
    return p * z * OVERHEAD_FACTOR;
  }, [modelSize, quantization]);

  const gpuSuggestions = useMemo((): GpuSuggestion[] => {
    if (requiredMemory === null || requiredMemory <= 0) return [];
    
    const suggestionsMap = new Map<string, GpuSuggestion>();
    const singleGpuOptions = GPUS.filter(gpu => gpu.memory >= requiredMemory);
    if (singleGpuOptions.length > 0) {
      const bestFit = singleGpuOptions[0];
      suggestionsMap.set(bestFit.name, { ...bestFit, count: 1 });
    }

    const multiGpuCandidates = GPUS.filter(gpu => gpu.type === 'Datacenter' || gpu.name === 'NVIDIA RTX 4090');
    for (const gpu of multiGpuCandidates) {
      if (gpu.memory < requiredMemory) {
        const count = Math.ceil(requiredMemory / gpu.memory);
        if (count > 1 && count <= 8) {
          suggestionsMap.set(gpu.name, { ...gpu, count });
        }
      }
    }
    
    if (suggestionsMap.size === 0 && GPUS.length > 0) {
      const bestGpu = GPUS[GPUS.length - 1];
      const count = Math.ceil(requiredMemory / bestGpu.memory);
      if (count > 1 && count <= 16) {
        suggestionsMap.set(bestGpu.name, { ...bestGpu, count });
      }
    }
  
    return Array.from(suggestionsMap.values()).sort((a,b) => a.count - b.count).slice(0, 3);
  }, [requiredMemory]);
  
  const topGpuSuggestion = gpuSuggestions[0] || null;

  const performanceMetrics = useMemo(() => {
    if (!topGpuSuggestion || !modelSize) return null;
    const p = parseFloat(modelSize);
    const bs = parseInt(batchSize, 10);
    const seq = parseInt(sequenceLength, 10);
    if (isNaN(p) || p <= 0 || isNaN(seq) || seq <= 0 || isNaN(bs) || bs <= 0) return null;

    const bytesPerParam = QUANTIZATION_FACTORS[quantization];
    const totalBandwidth = topGpuSuggestion.memory_bandwidth_gbps * topGpuSuggestion.count;

    // --- 1. Calculate Latency (Time To First Token) ---
    // This is dominated by the prefill step (processing the prompt), which is memory-bound.
    // A reasonable Memory Bandwidth Utilization (MBU) is assumed.
    const MBU = 0.6; // 60%
    const prefillTimeMs = (seq * p * bytesPerParam) / (totalBandwidth * MBU);
    const baseOverheadMs = 50; // Represents network latency, scheduling, etc.
    const latency = prefillTimeMs + baseOverheadMs;

    // --- 2. Calculate Throughput (Tokens per second) ---
    // This is dominated by the decoding step (generating tokens one-by-one).
    // This heuristic is also memory-bound but uses a different scaling factor.
    const DECODING_HEURISTIC_FACTOR = 0.6; // Empirically derived to align with benchmarks
    const BATCH_SCALING_FACTOR = 0.7; // Represents diminishing returns from batching

    // Time to generate one token for a single user
    const timePerTokenMs = ((p * bytesPerParam) / totalBandwidth) * 1000 * DECODING_HEURISTIC_FACTOR;
    const throughputPerUser = 1000 / timePerTokenMs;
    
    // Total throughput scales sub-linearly with batch size
    const effectiveBatchSize = Math.pow(bs, BATCH_SCALING_FACTOR);
    const throughput = throughputPerUser * effectiveBatchSize;

    return {
      throughput: throughput,
      latency: latency,
    };
  }, [topGpuSuggestion, modelSize, quantization, sequenceLength, batchSize]);

  const tcoComparison = useMemo(() => {
    const reqs = parseInt(requestsPerMonth, 10);
    const tokens = parseInt(avgTokensPerRequest, 10);
    const api = API_PRICING.find(a => a.name === selectedApi);
    if (!api || !topGpuSuggestion || isNaN(reqs) || isNaN(tokens)) return null;

    const getGpuHourlyCost = (gpu: GpuSuggestion) => {
        if (!gpu.cost) return null;
        const costs = [gpu.cost.aws, gpu.cost.gcp, gpu.cost.azure].filter(Boolean) as number[];
        if (costs.length === 0) return null;
        return costs.reduce((a,b) => a+b, 0) / costs.length; // Average cost
    };

    const hourlyCost = getGpuHourlyCost(topGpuSuggestion);
    if (hourlyCost === null) return null;
    
    const selfHostedMonthly = hourlyCost * topGpuSuggestion.count * HOURS_IN_MONTH;

    const totalTokens = reqs * tokens;
    const inputTokens = totalTokens * 0.7; // 70/30 split assumption
    const outputTokens = totalTokens * 0.3;
    const apiMonthly = (inputTokens / 1_000_000 * api.input_per_million) + (outputTokens / 1_000_000 * api.output_per_million);

    return { selfHostedMonthly, apiMonthly };
  }, [requestsPerMonth, avgTokensPerRequest, selectedApi, topGpuSuggestion]);

  // --- EVENT HANDLERS ---
  const handleUseCaseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newUseCase = e.target.value as UseCaseType;
    setUseCase(newUseCase);
    if (newUseCase !== UseCaseType.CUSTOM) {
        const firstModel = MODELS.filter(m => m.useCase === newUseCase)[0];
        if (firstModel) {
            setModelName(firstModel.name);
            setModelSize(String(firstModel.params));
            setQuantization(firstModel.quantization);
        }
    }
  };

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newModelName = e.target.value;
    setModelName(newModelName);
    const model = MODELS.find(m => m.name === newModelName && m.useCase === useCase);
    if (model) {
        setModelSize(String(model.params));
        setQuantization(model.quantization);
    }
  };

  const handleAddToComparison = useCallback(() => {
    if (requiredMemory === null) return;

    const suggestionForScenario = topGpuSuggestion ? {
        name: `${topGpuSuggestion.name} (${topGpuSuggestion.memory}GB)`,
        count: topGpuSuggestion.count,
        totalMemory: topGpuSuggestion.memory * topGpuSuggestion.count,
        totalHourlyCost: topGpuSuggestion.cost ? (Object.values(topGpuSuggestion.cost).filter(Boolean).reduce((a, b) => a + (b || 0), 0) / Object.values(topGpuSuggestion.cost).filter(Boolean).length) * topGpuSuggestion.count : undefined
    } : null;

    const newScenario: Scenario = {
        id: new Date().toISOString(),
        modelName: useCase === UseCaseType.CUSTOM ? `Custom (${modelSize}B)` : modelName,
        modelSize: parseFloat(modelSize),
        quantization,
        requiredMemory,
        gpuSuggestion: suggestionForScenario,
        performance: performanceMetrics,
        tco: tcoComparison,
    };
    setScenarios(prev => [...prev, newScenario]);
  }, [requiredMemory, modelName, modelSize, quantization, topGpuSuggestion, performanceMetrics, tcoComparison, useCase]);

  const handleCopy = () => {
    if (requiredMemory !== null) {
      const resultText = `${requiredMemory.toFixed(2)} GB`;
      navigator.clipboard.writeText(resultText).then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      });
    }
  };

  // --- RENDER ---
  return (
    <div className="min-h-screen w-full flex flex-col items-center bg-brand-light p-4 font-sans text-brand-dark">
      <main className="w-full max-w-4xl mx-auto flex flex-col gap-8">
        
        {/* Header */}
        <div className="text-center mt-8">
            <h1 className="text-4xl md:text-5xl font-bold text-brand-dark">LLM Solution Designer</h1>
            <p className="text-gray-500 mt-2 text-lg">From hardware sizing to cost analysis—design your complete LLM solution.</p>
        </div>

        {/* Calculator Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-8 flex flex-col space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {/* Use Case & Model Selection */}
                <div>
                    <label htmlFor="useCase" className="text-lg font-semibold text-gray-700">1. Select Use Case</label>
                    <select id="useCase" value={useCase} onChange={handleUseCaseChange} className="w-full mt-2 text-lg p-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-secondary focus:border-transparent transition-shadow">
                        {Object.values(UseCaseType).map(uc => <option key={uc} value={uc}>{uc}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="modelName" className="text-lg font-semibold text-gray-700">2. Choose Model</label>
                    <select id="modelName" value={modelName} onChange={handleModelChange} disabled={useCase === UseCaseType.CUSTOM} className="w-full mt-2 text-lg p-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-secondary focus:border-transparent transition-shadow disabled:bg-gray-100">
                        {MODELS.filter(m => m.useCase === useCase).map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
                    </select>
                </div>
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Model Size Input */}
                <div>
                    <label htmlFor="modelSize" className="text-lg font-semibold text-gray-700">Model Parameters (B)</label>
                    <div className="relative mt-2">
                        <input id="modelSize" type="number" value={modelSize} onChange={(e) => setModelSize(e.target.value)} placeholder="e.g., 70" disabled={useCase !== UseCaseType.CUSTOM} className="w-full text-xl p-3 pr-12 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-secondary focus:border-transparent transition-shadow disabled:bg-gray-100"/>
                        <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-lg text-gray-400 font-medium">B</span>
                    </div>
                </div>
                {/* Quantization Selection */}
                <div className="flex flex-col">
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">Quantization</h3>
                    <div className="grid grid-cols-2 gap-2 flex-grow">
                        {Object.values(QuantizationType).map(qType => (
                            <button key={qType} onClick={() => setQuantization(qType)} disabled={useCase !== UseCaseType.CUSTOM} className={`p-2 text-center rounded-lg font-semibold transition-all duration-200 text-sm border-2 ${quantization === qType ? 'bg-brand-primary text-white border-brand-primary shadow-md' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-200'} disabled:bg-gray-100 disabled:cursor-not-allowed`}>
                            {qType}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>

        {/* Results & Analysis Section */}
        <div className="bg-white rounded-2xl shadow-2xl">
            {/* Tabs */}
            <div className="border-b border-gray-200 flex">
                <button onClick={() => setActiveTab('summary')} className={`px-6 py-4 font-semibold text-lg transition-colors ${activeTab === 'summary' ? 'text-brand-primary border-b-4 border-brand-primary' : 'text-gray-500 hover:text-brand-dark'}`}>Summary</button>
                <button onClick={() => setActiveTab('analysis')} className={`px-6 py-4 font-semibold text-lg transition-colors ${activeTab === 'analysis' ? 'text-brand-primary border-b-4 border-brand-primary' : 'text-gray-500 hover:text-brand-dark'}`}>Cost & Performance</button>
                <button onClick={() => setActiveTab('comparison')} className={`px-6 py-4 font-semibold text-lg transition-colors ${activeTab === 'comparison' ? 'text-brand-primary border-b-4 border-brand-primary' : 'text-gray-500 hover:text-brand-dark'}`}>Scenario Comparison</button>
            </div>
            
            <div className="p-6 md:p-8">
                {/* Summary Tab */}
                {activeTab === 'summary' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="bg-gradient-to-br from-brand-primary to-brand-secondary text-white rounded-2xl shadow-xl p-8 flex flex-col items-center justify-center text-center">
                            <h2 className="text-2xl font-medium opacity-80">Required GPU Memory</h2>
                            <div className="my-2 text-6xl font-bold tracking-tight">
                                {requiredMemory !== null ? requiredMemory.toFixed(2) : '--'}
                                {requiredMemory !== null && <span className="text-4xl ml-2 opacity-80">GB</span>}
                            </div>
                            <p className="opacity-70 mt-2 text-sm">Includes 20% overhead for weights, KV cache & activations.</p>
                            <button onClick={handleCopy} disabled={!requiredMemory || isCopied} className="mt-4 bg-white/20 hover:bg-white/30 disabled:bg-white/10 text-white font-semibold py-2 px-5 rounded-lg transition-colors">
                                {isCopied ? 'Copied!' : 'Copy'}
                            </button>
                        </div>
                        <div>
                            <h3 className="text-xl font-bold mb-4 text-brand-dark">GPU Suggestions</h3>
                             <div className="space-y-3">
                                {!requiredMemory ? <p className="text-gray-500 italic text-center py-4">Enter model details to see suggestions.</p> :
                                 gpuSuggestions.length > 0 ? gpuSuggestions.map((gpu, index) => (
                                    <div key={index} className="bg-gray-50 p-4 rounded-lg">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-bold text-brand-dark">{gpu.name}</p>
                                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${gpu.type === 'Consumer' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>{gpu.type}</span>
                                            </div>
                                            <p className="text-2xl font-bold text-brand-primary">{gpu.count}x</p>
                                        </div>
                                        {gpu.cost && <div className="mt-2 pt-2 border-t text-xs text-gray-600">Est. Cost: ${(Object.values(gpu.cost).filter(Boolean).reduce((a, b) => a + (b || 0), 0) / Object.values(gpu.cost).filter(Boolean).length * gpu.count).toFixed(2)}/hr (avg)</div>}
                                    </div>
                                )) : <p className="text-gray-500 text-center py-4">This model may require a specialized multi-node cluster.</p>
                                }
                            </div>
                        </div>
                    </div>
                )}
                 {/* Analysis Tab */}
                {activeTab === 'analysis' && (
                    <div className="space-y-8">
                        <div>
                            <h3 className="text-xl font-bold mb-4 text-brand-dark">Performance Estimator</h3>
                            <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                                <div>
                                    <label className="font-semibold text-gray-600">Batch Size</label>
                                    <input type="number" value={batchSize} onChange={e => setBatchSize(e.target.value)} className="w-full mt-1 p-2 border-2 rounded-md"/>
                                </div>
                                <div>
                                    <label className="font-semibold text-gray-600">Sequence Length</label>
                                    <input type="number" value={sequenceLength} onChange={e => setSequenceLength(e.target.value)} className="w-full mt-1 p-2 border-2 rounded-md"/>
                                </div>
                                <div className="col-span-2 text-center border-t pt-4 mt-2">
                                    {performanceMetrics ? (
                                        <div className="flex justify-around">
                                            <div><p className="text-gray-500">Est. Throughput</p><p className="text-2xl font-bold text-brand-primary">{performanceMetrics.throughput.toFixed(0)} <span className="text-base font-normal">tokens/sec</span></p></div>
                                            <div><p className="text-gray-500">Est. Latency (TTFT)</p><p className="text-2xl font-bold text-brand-primary">{performanceMetrics.latency.toFixed(0)} <span className="text-base font-normal">ms</span></p></div>
                                        </div>
                                    ) : <p className="text-gray-500">Top GPU suggestion required for performance estimation.</p>}
                                </div>
                            </div>
                             <p className="text-xs text-gray-400 mt-2 text-center">* Performance metrics are high-level estimates based on heuristics and selected GPU configuration.</p>
                        </div>
                         <div>
                            <h3 className="text-xl font-bold mb-4 text-brand-dark">TCO: Self-Hosted vs. Managed API</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-lg">
                                <div>
                                    <label className="font-semibold text-gray-600">Requests/Month</label>
                                    <input type="number" value={requestsPerMonth} onChange={e => setRequestsPerMonth(e.target.value)} className="w-full mt-1 p-2 border-2 rounded-md"/>
                                </div>
                                <div>
                                    <label className="font-semibold text-gray-600">Avg Tokens/Req</label>
                                    <input type="number" value={avgTokensPerRequest} onChange={e => setAvgTokensPerRequest(e.target.value)} className="w-full mt-1 p-2 border-2 rounded-md"/>
                                </div>
                                <div>
                                    <label className="font-semibold text-gray-600">Compare API</label>
                                    <select value={selectedApi} onChange={e => setSelectedApi(e.target.value)} className="w-full mt-1 p-2 border-2 rounded-md bg-white">
                                        {API_PRICING.map(api => <option key={api.name}>{api.name}</option>)}
                                    </select>
                                </div>
                                <div className="col-span-1 md:col-span-3 text-center border-t pt-4 mt-2">
                                     {tcoComparison ? (
                                        <div className="flex justify-around">
                                            <div><p className="text-gray-500">Est. Self-Hosted Monthly</p><p className="text-2xl font-bold text-green-600">${tcoComparison.selfHostedMonthly.toLocaleString('en-US', {maximumFractionDigits: 0})}</p></div>
                                            <div><p className="text-gray-500">Est. API Monthly</p><p className="text-2xl font-bold text-blue-600">${tcoComparison.apiMonthly.toLocaleString('en-US', {maximumFractionDigits: 0})}</p></div>
                                        </div>
                                    ) : <p className="text-gray-500">Top GPU suggestion with cost data required for TCO estimation.</p>}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {/* Comparison Tab */}
                {activeTab === 'comparison' && (
                     <div className="space-y-4">
                        <h3 className="text-xl font-bold text-brand-dark">Scenario Comparison</h3>
                        {scenarios.length > 0 ? (
                           <div className="overflow-x-auto">
                             <table className="w-full text-sm text-left text-gray-600">
                               <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                 <tr>
                                   <th scope="col" className="px-4 py-3">Model</th>
                                   <th scope="col" className="px-4 py-3">Memory</th>
                                   <th scope="col" className="px-4 py-3">GPU Config</th>
                                   <th scope="col" className="px-4 py-3">Throughput</th>
                                   <th scope="col" className="px-4 py-3">Self-Host Cost</th>
                                   <th scope="col" className="px-4 py-3">API Cost</th>
                                   <th scope="col" className="px-4 py-3"></th>
                                 </tr>
                               </thead>
                               <tbody>
                                 {scenarios.map(s => (
                                   <tr key={s.id} className="bg-white border-b hover:bg-gray-50">
                                     <td className="px-4 py-3 font-medium">{s.modelName} ({s.quantization})</td>
                                     <td className="px-4 py-3">{s.requiredMemory.toFixed(2)} GB</td>
                                     <td className="px-4 py-3">{s.gpuSuggestion ? `${s.gpuSuggestion.count}x ${s.gpuSuggestion.name}` : 'N/A'}</td>
                                     <td className="px-4 py-3">{s.performance ? `${s.performance.throughput.toFixed(0)} tok/s` : '--'}</td>
                                     <td className="px-4 py-3 font-semibold text-green-600">{s.tco ? `$${s.tco.selfHostedMonthly.toLocaleString(undefined, {maximumFractionDigits: 0})}/mo` : '--'}</td>
                                     <td className="px-4 py-3 font-semibold text-blue-600">{s.tco ? `$${s.tco.apiMonthly.toLocaleString(undefined, {maximumFractionDigits: 0})}/mo` : '--'}</td>
                                     <td className="px-4 py-3"><button onClick={() => setScenarios(scenarios.filter(sc => sc.id !== s.id))} className="text-red-500 hover:text-red-700">&times;</button></td>
                                   </tr>
                                 ))}
                               </tbody>
                             </table>
                           </div>
                        ) : (
                            <p className="text-gray-500 italic text-center py-8">Add a scenario to start comparing.</p>
                        )}
                         <div className="flex justify-end gap-4 mt-4">
                           <button onClick={() => setScenarios([])} disabled={scenarios.length === 0} className="bg-gray-200 text-gray-700 font-semibold py-2 px-5 rounded-lg transition-colors hover:bg-gray-300 disabled:opacity-50">Clear All</button>
                           <button className="bg-gray-200 text-gray-700 font-semibold py-2 px-5 rounded-lg transition-colors hover:bg-gray-300 disabled:opacity-50" disabled>Download PDF (Coming Soon)</button>
                         </div>
                    </div>
                )}
            </div>
             {/* Add to Comparison Button */}
            <div className="p-6 md:p-8 border-t bg-gray-50 rounded-b-2xl">
                <button onClick={handleAddToComparison} className="w-full bg-brand-secondary hover:bg-brand-primary text-white font-bold py-4 px-6 rounded-lg transition-all shadow-lg hover:shadow-xl text-xl">
                    Add Current Configuration to Comparison
                </button>
            </div>
        </div>

        {/* How It Works Section */}
        <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8">
            <h3 className="text-2xl font-bold mb-6 text-brand-dark text-center">How It Works</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                <div className="flex flex-col items-center">
                    <div className="flex-shrink-0 w-12 h-12 bg-brand-secondary text-white rounded-full flex items-center justify-center font-bold text-2xl mb-3">1</div>
                    <h4 className="font-bold text-lg">Pick a Use Case</h4>
                    <p className="text-gray-600 mt-1">Start by selecting your task, like "Chat" or "Code Gen", to see recommended models.</p>
                </div>
                <div className="flex flex-col items-center">
                    <div className="flex-shrink-0 w-12 h-12 bg-brand-secondary text-white rounded-full flex items-center justify-center font-bold text-2xl mb-3">2</div>
                    <h4 className="font-bold text-lg">Analyze Results</h4>
                    <p className="text-gray-600 mt-1">Instantly see the required memory, GPU options, and estimated performance and TCO in the tabs.</p>
                </div>
                <div className="flex flex-col items-center">
                    <div className="flex-shrink-0 w-12 h-12 bg-brand-secondary text-white rounded-full flex items-center justify-center font-bold text-2xl mb-3">3</div>
                    <h4 className="font-bold text-lg">Compare Scenarios</h4>
                    <p className="text-gray-600 mt-1">Add multiple configurations to the comparison table to find the optimal solution for your client.</p>
                </div>
            </div>
        </div>
      </main>
       <footer className="text-center text-gray-500 my-12">
         <p>A powerful design tool for LLM Solution Engineers.</p>
      </footer>
    </div>
  );
};

export default App;
