export class State {
  public breakpoint?: boolean;  
  public fact: Record<string, any>;
  public result: Record<string, any>;
  public context: Record<string, any>;

  constructor(fact: Record<string, any>, result: Record<string, any>, context: Record<string, any>, breakpoint?: boolean) {
    this.fact = structuredClone(fact);
    this.result = structuredClone(result);
    this.context = structuredClone(context);
    this.breakpoint = breakpoint;
  }
}