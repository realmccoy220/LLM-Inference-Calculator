
export interface GPU {
  name: string;
  memory: number; // in GB
  type: 'Consumer' | 'Datacenter';
  tflops_fp16: number; // TFLOPS for FP16 precision
  memory_bandwidth_gbps: number; // Memory bandwidth in GB/s
  cost?: {
    aws?: number; // Cost per hour
    gcp?: number;
    azure?: number;
  };
}

// FIX: The array is defined with a type annotation before sorting to fix a TypeScript type inference error.
// Chaining .sort() directly to the array literal was causing the 'type' property to be incorrectly
// inferred as a generic string instead of '"Consumer" | "Datacenter"'.
const gpus: GPU[] = [
  // Consumer GPUs
  { name: 'NVIDIA RTX 3090', memory: 24, type: 'Consumer', tflops_fp16: 35.6, memory_bandwidth_gbps: 936 },
  { name: 'NVIDIA RTX 4090', memory: 24, type: 'Consumer', tflops_fp16: 82.6, memory_bandwidth_gbps: 1008 },
  
  // Datacenter GPUs with estimated hourly costs
  { name: 'NVIDIA L4', memory: 24, type: 'Datacenter', tflops_fp16: 30.3, memory_bandwidth_gbps: 300, cost: { aws: 0.65, gcp: 0.70, azure: 0.68 } },
  { name: 'NVIDIA A100 (40GB)', memory: 40, type: 'Datacenter', tflops_fp16: 312, memory_bandwidth_gbps: 1555, cost: { aws: 2.10, gcp: 1.85, azure: 2.00 } },
  { name: 'NVIDIA L40S', memory: 48, type: 'Datacenter', tflops_fp16: 145.3, memory_bandwidth_gbps: 864, cost: { gcp: 2.25, azure: 2.30 } },
  { name: 'NVIDIA A100 (80GB)', memory: 80, type: 'Datacenter', tflops_fp16: 312, memory_bandwidth_gbps: 2039, cost: { aws: 4.10, gcp: 3.22, azure: 3.90 } },
  { name: 'NVIDIA H100 (PCIe)', memory: 80, type: 'Datacenter', tflops_fp16: 989, memory_bandwidth_gbps: 2000, cost: { aws: 4.50, gcp: 3.80, azure: 4.30 } },
];

// In-place sort by memory capacity, then by name for consistent ordering.
gpus.sort((a, b) => {
    if (a.memory === b.memory) {
        return a.name.localeCompare(b.name);
    }
    return a.memory - b.memory;
});

// Export the sorted data for common GPUs.
export const GPUS: GPU[] = gpus;
