import { State } from "./State";
import { StepState } from "./StepState";

export class Explanation {
  public initial: State;
  public final: State;  
  public stepStates: StepState[] = [];

  /**
   * Record final state
   * @param fact
   * @param result
   * @param context
   */
  public recordInitial(fact: Record<string, any>, result: Record<string, any>, context: Record<string, any>) {
    this.initial = new State(fact, result, context);
  }

  /**
   * Record step start
   * @param name
   * @param fact
   * @param result
   * @param context
   */
  public recordStepStart(name: string, fact: Record<string, any>, result: Record<string, any>, context: Record<string, any>): void {
    this.stepStates.push(new StepState(name, fact, result, context));
  }

  /**
   * Record step end
   * @param fact
   * @param result
   * @param context
   * @param breakPoint
   */
  public recordStepEnd(fact: Record<string, any>, result: Record<string, any>, context: Record<string, any>, breakPoint: boolean): void {
    const lastStepState = this.stepStates[this.stepStates.length - 1];
    lastStepState.recordAfter(fact, result, context);
    if (breakPoint) {
      lastStepState.recordBreakpoint();
    }
  }

  /**
   * Record applied step rule
   * @param ruleName 
   */
  public recordStepRule(ruleName: string) {
    const lastStepState = this.stepStates[this.stepStates.length - 1];
    lastStepState.recordAppliedRule(ruleName);
  }

  /**
   * Record final state
   * @param fact
   * @param result
   * @param context
   */
  public recordFinal(fact: Record<string, any>, result: Record<string, any>, context: Record<string, any>) {
    this.final = new State(fact, result, context);
  }
}