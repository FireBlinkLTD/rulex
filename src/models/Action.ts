const betterEval = require('better-eval');

export class Action {
  public static INITIAL_VALUE_VAR = '__initialValue__'
  private readonly raw: string;
  private readonly initialValue: any;
  private script: {
    run: (context: Record<string, any>, fact: Record<string, any>, result: Record<string, any>, initialValue: any) => void;
  };

  constructor(raw: string, value?: any) {
    this.raw = raw;
    this.initialValue = value;
    this.script = betterEval(`({ run: (context, fact, result, ${Action.INITIAL_VALUE_VAR}) => { ${this.raw} } })`); 
  }

  /**
   * Process action
   * @param context 
   * @param fact 
   */
  public process(context: Record<string, any>, fact: Record<string, any>, result: Record<string, any>): void {
    this.script.run(context, fact, result, this.initialValue);
  }
}