import {suite, test} from '@testdeck/mocha';
import { ok, strictEqual } from 'assert';
import RulexEngine, { RuleError } from '../src';

@suite()
class E2ESuite {
  private static FILE = './test/assets/rules.xlsx';
  private static EMPTY_FILE = './test/assets/empty.xlsx';
  private static BROKEN_FILE = './test/assets/broken.xlsx';

  /**
   * Prepare Engine
   * @returns 
   */
  private async prepareEngine(): Promise<RulexEngine> {
    const engine = new RulexEngine(console.log);
    await engine.init(E2ESuite.FILE);
    
    return engine;
  }

  /**
   * Prepares a fact
   */
  private get fact(): Record<string, any> {
    return {
      boolValue: true,
      intValue: 5,
      floatValue: 5.5,
      dateValue: new Date('2023-01-01'),
      strValue: 'string with spaces',
      break: false,
      error: false,
    }
  }

  @test()
  async "Context"(): Promise<void> {
    const engine = await this.prepareEngine();

    strictEqual(engine.context.initBoolValue, true);
    strictEqual(engine.context.initIntValue, 5);
    strictEqual(engine.context.initFloatValue, 5.3);
    strictEqual(engine.context.initDateValue?.toISOString(), new Date('2022-08-01').toISOString());
    strictEqual(engine.context.initStrValue, 'test');	    
  }

  @test()
  async "Context - Empty"(): Promise<void> {
    const engine = await this.prepareEngine();
    
    let error: Error;
    try {
      // re-init with empty file
      await engine.init(E2ESuite.EMPTY_FILE);
    } catch (e) {
      error = e;
    }

    strictEqual(error.message, 'Worksheet "Context" is empty');
  }

  @test()
  async "Context - Broken"(): Promise<void> {
    const engine = await this.prepareEngine();
    
    let error: Error;
    try {
      // re-init with broken file
      await engine.init(E2ESuite.BROKEN_FILE);
    } catch (e) {
      error = e;
    }

    strictEqual(error.message, 'Worksheet "Context" is missing required column "name"');
  }

  @test()
  async "Extra Context variables"(): Promise<void> {
    const engine = await this.prepareEngine();

    const fact = this.fact;
    const result = await engine.process(fact, { extraVariable: true });

    strictEqual(result.context.extraVariable, true);    
  } 

  @test()
  async "Test"(): Promise<void> {
    const engine = await this.prepareEngine();
    
    let error: Error;
    try {
      // re-init and test this time
      await engine.init(E2ESuite.FILE, true);
    } catch (e) {
      error = e;
    }

    strictEqual(error, undefined);    
  } 

  @test()
  async "Explain"(): Promise<void> {
    const engine = await this.prepareEngine();

    const fact = this.fact;
    const result = await engine.process(fact, {}, true);

    strictEqual(result.explanation.stepStates.length, 6);
    strictEqual(result.explanation.stepStates[0].appliedRules.length, 7);    
  } 

  @test()
  async "Dependency"(): Promise<void> {
    const engine = await this.prepareEngine();

    const fact = this.fact;
    const result = await engine.process(fact);

    strictEqual(result.context['dependency'], true);
  } 

  @test()
  async "Step 1 - Condition + Action"(): Promise<void> {
    const engine = await this.prepareEngine();

    const fact = this.fact;
    const result = await engine.process(fact);

    strictEqual(result.context['Simple Condition'], true);
    strictEqual(result.context['Complex Condition'], true);    
    strictEqual(result.context['Empty Condition'], true);    
    strictEqual(result.context['String Condition'], true);    
    strictEqual(result.context['Math'], true);    
  } 

  @test()
  async "Step 2 - If + Set"(): Promise<void> {
    const engine = await this.prepareEngine();

    const fact = this.fact;
    let result = await engine.process(fact);
    strictEqual(result.context.step2, 1);
    strictEqual(result.context.step2date.getTime(), new Date('2022-01-01').getTime());
    strictEqual(result.context.step2IfNotValue, undefined);
    
    fact.boolValue = false;
    result = await engine.process(fact);
    strictEqual(result.context.step2, 2);
    strictEqual(result.context.step2date.getTime(), new Date('2022-01-02').getTime());
    strictEqual(result.context.step2IfNotValue, true);

    fact.boolValue = null;
    result = await engine.process(fact);
    strictEqual(result.context.step2, 3);
    strictEqual(result.context.step2date.getTime(), new Date('2022-01-03').getTime());
    strictEqual(result.context.step2IfNotValue, true);
  }

  @test()
  async "Step 3 - In and Out"(): Promise<void> {
    const engine = await this.prepareEngine();

    const fact = this.fact;
    let result = await engine.process(fact);
    strictEqual(result.context.step3int_in, true);
    strictEqual(result.context.step3int_out, true);
    strictEqual(result.context.step3str_in, true);
    strictEqual(result.context.step3str_out, true);
    strictEqual(result.context.step3last_in, undefined);
    strictEqual(result.context.step3last_out, undefined);
  }

  @test()
  async "Step 5 - Type"(): Promise<void> {
    const engine = await this.prepareEngine();

    const fact = this.fact;
    let result = await engine.process(fact);
    strictEqual(result.context.step4, 1);
    strictEqual(result.context.step4blank, 1);
  }

  @test()
  async "Step 5 - Break"(): Promise<void> {
    const engine = await this.prepareEngine();

    const fact = this.fact;
    let result = await engine.process(fact);
    strictEqual(result.context.step6, true);

    fact.break = true;
    result = await engine.process(fact, {}, true);
    strictEqual(result.context.step6, undefined);
  }

  @test()
  async "Step 5 - Error"(): Promise<void> {
    const engine = await this.prepareEngine();

    const fact = this.fact;
    fact.error = true;
    let error: RuleError;
    try {
      await engine.process(fact, {}, true);
    } catch (err) {      
      error = err;
    }
    
    ok(error);
    ok(error instanceof RuleError);
    ok(error.context);
    ok(error.fact);
    strictEqual(error.message, "fact.error couldn't be true");
    strictEqual(error.code, "E-Test");
    strictEqual(error.step, 'Step 5 - Break');
    strictEqual(error.rule, 'Error');
  }
}