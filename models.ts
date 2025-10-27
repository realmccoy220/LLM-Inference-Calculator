
import { Model, UseCaseType, QuantizationType } from './types';

export const MODELS: Model[] = [
    // Chat & Conversation
    { name: 'Llama 3 (8B)', params: 8, quantization: QuantizationType.FP16, useCase: UseCaseType.CHAT_CONVERSATION },
    { name: 'Llama 3 (70B)', params: 70, quantization: QuantizationType.FP16, useCase: UseCaseType.CHAT_CONVERSATION },
    { name: 'Mixtral (8x7B)', params: 47, quantization: QuantizationType.FP16, useCase: UseCaseType.CHAT_CONVERSATION },
    { name: 'Mistral Large', params: 128, quantization: QuantizationType.FP16, useCase: UseCaseType.CHAT_CONVERSATION },

    // Code Generation
    { name: 'Llama 3 (8B)', params: 8, quantization: QuantizationType.FP16, useCase: UseCaseType.CODE_GENERATION },
    { name: 'Code Llama (34B)', params: 34, quantization: QuantizationType.FP16, useCase: UseCaseType.CODE_GENERATION },
    { name: 'DeepSeek Coder (33B)', params: 33, quantization: QuantizationType.FP16, useCase: UseCaseType.CODE_GENERATION },
    { name: 'Mixtral (8x7B)', params: 47, quantization: QuantizationType.FP16, useCase: UseCaseType.CODE_GENERATION },

    // Data Extraction (JSON)
    { name: 'Llama 3 (8B)', params: 8, quantization: QuantizationType.FP16, useCase: UseCaseType.DATA_EXTRACTION },
    { name: 'Llama 3 (70B)', params: 70, quantization: QuantizationType.INT4, useCase: UseCaseType.DATA_EXTRACTION },
    { name: 'Mixtral (8x7B)', params: 47, quantization: QuantizationType.INT4, useCase: UseCaseType.DATA_EXTRACTION },
];
