const betterEval = require('better-eval');

export class Condition {
  public static INITIAL_VALUE_VAR = '__initialValue__'
  private raw: string;
  private readonly initialValue: any;
  private script: {
    run: (context: Record<string, any>, fact: Record<string, any>, result: Record<string, any>, initialValue: any) => boolean;
  };

  constructor(raw: string, value?: any) {
    this.raw = raw;
    this.initialValue = value;
    this.script = betterEval(`({ run: (context, fact, result, ${Condition.INITIAL_VALUE_VAR}) => { return ${this.raw} } })`); 
  }

  /**
   * Process condition
   * @param context 
   * @param fact 
   * @returns true when condition is positive
   */
  public process(context: Record<string, any>, fact: Record<string, any>, result: Record<string, any>): boolean {
    return this.script.run(context, fact, result, this.initialValue);
  }
}