
export enum QuantizationType {
  INT4 = 'INT4',
  INT8_FP8 = 'INT8 / FP8',
  FP16 = 'FP16',
  FP32 = 'FP32',
}

export enum UseCaseType {
    CUSTOM = 'Custom',
    CHAT_CONVERSATION = 'Chat & Conversation',
    CODE_GENERATION = 'Code Generation',
    DATA_EXTRACTION = 'Data Extraction (JSON)',
}

export interface Model {
    name: string;
    params: number;
    quantization: QuantizationType;
    useCase: UseCaseType;
}

export interface Scenario {
    id: string;
    modelName: string;
    modelSize: number;
    quantization: QuantizationType;
    requiredMemory: number;
    gpuSuggestion: {
        name: string;
        count: number;
        totalMemory: number;
        totalHourlyCost?: number;
    } | null;
    performance: {
        throughput: number;
        latency: number;
    } | null;
    tco: {
        selfHostedMonthly: number;
        apiMonthly: number;
    } | null;
}
