const betterEval = require('better-eval');

export class Condition {
  private raw: string;
  private script: {
    run: (context: Record<string, any>, fact: Record<string, any>, result: Record<string, any>) => boolean;
  };

  constructor(raw: string) {
    this.raw = raw;
    this.script = betterEval(`({ run: (context, fact, result) => { return ${this.raw} } })`); 
  }

  /**
   * Process condition
   * @param context 
   * @param fact 
   * @returns true when condition is positive
   */
  public process(context: Record<string, any>, fact: Record<string, any>, result: Record<string, any>): boolean {
    return this.script.run(context, fact, result);
  }
}