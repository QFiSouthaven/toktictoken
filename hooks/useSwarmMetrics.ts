import { useMemo } from 'react';
import { Message } from '../types';

export const useSwarmMetrics = (messages: Message[]) => {
  return useMemo(() => {
    return messages.reduce((acc, msg) => {
        if (msg.usage) {
            acc.totalTokens += msg.usage.totalTokens;
            acc.promptTokens += msg.usage.promptTokens;
            acc.completionTokens += msg.usage.responseTokens;
        }
        if (msg.cost) {
            acc.totalCost += msg.cost;
        }
        return acc;
    }, { totalTokens: 0, promptTokens: 0, completionTokens: 0, totalCost: 0 });
  }, [messages]);
};

export const formatCost = (cost: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 4 }).format(cost);
};
