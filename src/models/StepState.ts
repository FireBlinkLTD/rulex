import { State } from "./State";

export class StepState {
  public name: string;
  public before: State;
  public appliedRules: string[] = [];
  public after: State;  
  public breakpoint: boolean = false;
  
  constructor(name: string, fact: Record<string, any>, result: Record<string, any>, context: Record<string, any>) {
    this.name = name;
    this.before = new State(fact, result, context);
  }

  /**
   * Record applied rule name
   * @param ruleName 
   */
  public recordAppliedRule(ruleName: string) {
    this.appliedRules.push(ruleName);
  }

  /**
   * Record breakpoint hit
   */
  public recordBreakpoint(): void {
    this.breakpoint = true;
  }

  /**
   * Record state after the execution
   */
  public recordAfter(fact: Record<string, any>, result: Record<string, any>, context: Record<string, any>): void {
    this.after = new State(fact, result, context);
  }
}