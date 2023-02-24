const betterEval = require('better-eval');

export class Action {
  private readonly raw: string;
  private script: {
    run: (context: Record<string, any>, fact: Record<string, any>, result: Record<string, any>) => void;
  };

  constructor(raw: string) {
    this.raw = raw;
    this.script = betterEval(`({ run: (context, fact, result) => { ${this.raw} } })`); 
  }

  /**
   * Process action
   * @param context 
   * @param fact 
   */
  public process(context: Record<string, any>, fact: Record<string, any>, result: Record<string, any>): void {
    this.script.run(context, fact, result);
  }
}