
export interface ApiPricing {
    name: string;
    input_per_million: number; // USD per 1 million input tokens
    output_per_million: number; // USD per 1 million output tokens
}

export const API_PRICING: ApiPricing[] = [
    { name: 'Gemini 1.5 Flash', input_per_million: 0.35, output_per_million: 1.05 },
    { name: 'Gemini 1.5 Pro', input_per_million: 3.50, output_per_million: 10.50 },
    { name: 'OpenAI GPT-4o', input_per_million: 5.00, output_per_million: 15.00 },
    { name: 'Anthropic Claude 3.5 Sonnet', input_per_million: 3.00, output_per_million: 15.00 },
];
