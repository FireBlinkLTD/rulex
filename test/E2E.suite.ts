import {suite, test} from '@testdeck/mocha';
import { strictEqual } from 'assert';
import RulexEngine from '../src';

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
   * Prepares a payload
   */
  private get payload(): Record<string, any> {
    return {
      boolValue: true,
      intValue: 5,
      floatValue: 5.5,
      dateValue: new Date('2023-01-01'),
      strValue: 'string with spaces',
      break: false,
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

    const payload = this.payload;
    const result = await engine.process(payload, { extraVariable: true });

    strictEqual(result.context.extraVariable, true);    
  } 

  @test()
  async "Step 1 - Condition + Action"(): Promise<void> {
    const engine = await this.prepareEngine();

    const payload = this.payload;
    const result = await engine.process(payload);

    strictEqual(result.context['Simple Condition'], true);
    strictEqual(result.context['Complex Condition'], true);    
    strictEqual(result.context['Empty Condition'], true);    
    strictEqual(result.context['String Condition'], true);    
    strictEqual(result.context['Math'], true);    
  } 

  @test()
  async "Step 2 - If + Set"(): Promise<void> {
    const engine = await this.prepareEngine();

    const payload = this.payload;
    let result = await engine.process(payload);
    strictEqual(result.context.step2, 1);   
    
    payload.boolValue = false;
    result = await engine.process(payload);
    strictEqual(result.context.step2, 2);

    payload.boolValue = null;
    result = await engine.process(payload);
    strictEqual(result.context.step2, 3);
  }

  @test()
  async "Step 3 - Break"(): Promise<void> {
    const engine = await this.prepareEngine();

    const payload = this.payload;
    let result = await engine.process(payload);
    strictEqual(result.context.step4, true);

    payload.break = true;
    result = await engine.process(payload);
    strictEqual(result.context.step4, undefined);
  }
}