import { Explanation } from "../models";

export class RuleError extends Error {  
  constructor(
    message: string, 
    public code: string,
    public step: string,
    public rule: string,
    public explanation: Explanation | undefined,
    public context: Record<string, any>,
    public fact: Record<string, any>,
  ) {
    super(message);    
  }
}