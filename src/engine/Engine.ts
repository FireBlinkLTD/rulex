import { equal } from "assert";
import exp = require("constants");
import { Workbook, Worksheet } from "exceljs";
import { Action, Condition, Explanation, Rule, Step } from "../models";
import { RuleError } from "../errors";

export class Engine {
  public readonly steps: Step[] = [];
  public readonly context: Record<string, any> = {};

  constructor(
    private log?: (msg: string) => void,
  ) {
  }

  /**
   * Init Engine
   * @param rulesFilePath 
   * @param test
   */
  public async init(rulesFilePath: string, test: boolean = false): Promise<void> {
    for (const key of Object.keys(this.context)) {
      delete this.context[key];
    };
    this.steps.splice(0, this.steps.length);

    await this.readExcelFile(rulesFilePath, test);    
  }

  /**
   * Process 
   * @param fact 
   * @param extraContextVariables
   * @param explain
   * @returns 
   */
  public async process(
    fact: Record<string, any>, 
    extraContextVariables?: Record<string, any>,
    explain?: boolean
  ): Promise<{
    result: Record<string, any>,
    context: Record<string, any>,
    fact: Record<string, any>,
    explanation?: Explanation,
  }> {
    const explanation = new Explanation();
    const result: Record<string, any> = {};

    // create a copy of the context and fact
    const context = structuredClone({
      ...this.context,
      ...(extraContextVariables ?? {})
    });
    fact = structuredClone(fact);

    if (explain) {
      explanation.recordInitial(fact, result, context);
    }

    let errorRule: Rule = null;
    let errorStep: string;
    for (const step of this.steps) {
      this.log(`Processing step "${step.name}"...`);
      let breakPoint = false;
      
      if (explain) {
        explanation.recordStepStart(step.name, fact, result, context);
      }

      for (const rule of step.rules) {
        this.log(`Processing step "${step.name}" rule "${rule.name}"...`);
        let apply = true;
        let i = 0;
        for (const condition of rule.conditions) {
          i++;
          apply = condition.process(context, fact, result);
          if (!apply) {
            this.log(`Step "${step.name}" rule "${rule.name}" condition #${i} doesn't apply: ${condition}`);
            break;
          }
        }

        if (apply) {
          this.log(`Apply step "${step.name}" rule "${rule.name}" actions...`);
          for (const action of rule.actions) {
            action.process(context, fact, result);                        
          }

          if (rule.break) {
            this.log(`Step "${step.name}" rule "${rule.name}" hit break point`);
            breakPoint = true;
            break;
          }

          if (rule.error) {
            this.log(`Step "${step.name}" rule "${rule.name}" hit error point`);
            breakPoint = true;
            errorRule = rule;   
            errorStep = step.name;         
            break;
          }

          if (explain) {
            explanation.recordStepRule(rule.name);
          }
        }
      }   
      
      if (explain) {
        explanation.recordStepEnd(fact, result, context, breakPoint);       
      }

      if (breakPoint) {
        break;
      }
    }

    if (explain) {
      explanation.recordFinal(fact, result, context);
    }
    
    const finalExplanation = explain ? explanation : undefined;
    if (errorRule) {
      throw new RuleError(
        errorRule.error,
        errorRule.errorCode,
        errorStep,
        errorRule.name,
        finalExplanation,
        context,
        fact,
      );      
    }

    return {
      result,
      context,
      fact,
      explanation: finalExplanation,
    };
  }

  /**
   * Read Excel file and generate step definitions
   * @param rulesFilePath 
   * @param test
   */
  private async readExcelFile(rulesFilePath: string, test: boolean): Promise<void> {
    this.log(`Reading excel file ${rulesFilePath}`);
    const workbook = await new Workbook().xlsx.readFile(rulesFilePath);

    let testWorksheetNames: string[] = [];
    workbook.eachSheet((worksheet: Worksheet) => {
      const name = worksheet.name.toLowerCase().trim();
      if (name === 'context') {
        this.readContextWorksheet(worksheet);
        
        return;
      }

      if (name.indexOf('step') === 0) { 
        this.readStepWorksheet(worksheet);

        return;
      }   
      
      /* istanbul ignore else */
      if (test && name.indexOf('test') === 0) {
        testWorksheetNames.push(worksheet.name);

        return;
      }
    });

    // steps should be alphabetically sorted
    this.steps.sort((a, b) => {
      return a.name.toLowerCase().trim().localeCompare(b.name.toLowerCase().trim());
    });

    for (const testWorksheetName of testWorksheetNames) {
      await this.readTestWorksheet(workbook.getWorksheet(testWorksheetName));
    }

    this.log(`Finished reading excel file, found ${this.steps.length} step(s)`);
  }

  /**
   * Read tests worksheet and execute it
   * @param worksheet 
   */
  private async readTestWorksheet(worksheet: Worksheet): Promise<void> {
    this.log(`Reading "${worksheet.name}" to run self testing`);
    let tests: {
      name: string,
      initial: {
        fact: Record<string, any>,
        context: Record<string, any>,
      },
      expected: {
        fact: Record<string, any>,
        context: Record<string, any>,
        result: Record<string, any>,
      }
    }[] = [];

    let name = '';
    let initial: Action[] = [];
    let expected: Action[] = [];
    
    this.readWorksheet(
      worksheet, 
      ['name'], 
      (n, v, rawName) => {
        if (n === 'name') {
          name = v;

          return;
        }

        if (n.indexOf('set ') === 0) {
          initial.push(new Action(`${rawName.substring('set '.length)} = ${Action.INITIAL_VALUE_VAR}`, v));
        }

        if (n.indexOf('expect ') === 0) {
          expected.push(new Action(`${rawName.substring('expect '.length)} = ${Action.INITIAL_VALUE_VAR}`, v));
        }
      },
      () => {
        // prepare initial state
        const fact = {};
        const context = {};        
        initial.forEach(a => a.process(context, fact, {}));
        
        // prepare expected state
        const expectedFact = {};
        const expectedContext = {}; 
        const expectedResult = {}; 
        expected.forEach(e => e.process(expectedContext, expectedFact, expectedResult));

        tests.push({
          name,
          initial: {
            fact,
            context,
          },
          expected: {
            fact: expectedFact,
            context: expectedContext,
            result: expectedResult,
          }
        })

        name = null;
        initial = [];
        expected = [];
      }
    );

    for (const test of tests) {
      this.log(`Running "${test.name}" test`);
      const { fact, context, result } = await this.process(test.initial.fact, test.initial.context);

      try {
        for (const key of Object.keys(test.expected.context)) {
          equal(context[key], test.expected.context[key], `Test "${test.name}". Expected context.${key} to be strictly equal: ${JSON.stringify(test.expected.context[key])} !== ${JSON.stringify(context[key])}`);
        }

        for (const key of Object.keys(test.expected.fact)) {
          equal(fact[key], test.expected.fact[key], `Test "${test.name}". Expected fact.${key} to be strictly equal: ${JSON.stringify(test.expected.fact[key])} !== ${JSON.stringify(fact[key])}`);
        }

        for (const key of Object.keys(test.expected.result)) {
          equal(result[key], test.expected.result[key], `Expected fact.${key} to be strictly equal: ${JSON.stringify(test.expected.result[key])} !== ${JSON.stringify(result[key])}`);
        }
      } catch (err) {
        this.log(`Test "${test.name}" failed`);
        console.log('\nFact:\n', JSON.stringify(fact, null, 2));
        console.log('\nContext:\n', JSON.stringify(context, null, 2));
        console.log('\nResult:\n', JSON.stringify(result, null, 2));
        throw err;
      }
    }
  }

  /**
   * Read context worksheet
   * @param worksheet    
   */
  private readContextWorksheet(worksheet: Worksheet): void {
    this.log(`Reading "${worksheet.name}" for context variables`);
    let name: string;
    let value: any;
    this.readWorksheet(
      worksheet, 
      ['name', 'value'], 
      (n, v) => {
        if (n === 'name') {
          name = v;
          
          return;
        }

        /* istanbul ignore else */
        if (n === 'value') {
          value = v;
          
          return;
        }
      },
      () => {
        this.context[name] = value;
        name = undefined;
        value = undefined;        
      }
    );    
  }

  /**
   * Read step worksheet
   * @param worksheet 
   * @returns 
   */
  private readStepWorksheet(worksheet: Worksheet): void {
    this.log(`Reading "${worksheet.name}" for step definition`);
    const rules: Rule[] = [];
    let rule = new Rule();
    this.readWorksheet(
      worksheet, 
      ['name'], 
      (name, value, rawName) => {
        if (name === 'name') {
          rule.name = value;

          return;
        }

        if (name === 'break') {
          rule.break = value;

          return;
        }

        if (name.indexOf('error')  === 0) {
          rule.error = value;
          rule.errorCode = rawName.substring('error '.length);
        }

        if (name.indexOf('in ')  === 0) {
          const key = rawName.substring('in '.length);
          if (value === null) {
            rule.conditions.push(new Condition(`true`));
          } else {
            rule.conditions.push(new Condition(`[${value}].indexOf(${key}) >= 0`));
          }
        }

        if (name.indexOf('out ')  === 0) {
          const key = rawName.substring('out '.length);
          if (value === null) {
            rule.conditions.push(new Condition(`true`));
          } else {
            rule.conditions.push(new Condition(`[${value}].indexOf(${key}) < 0`));
          }
        }

        if (name.indexOf('if ') === 0) {
          let conditionString = 'if ';
          const reverse = name.indexOf('if not ') === 0;          
          if (reverse) {
            conditionString += 'not ';
          }
          const key = rawName.substring(conditionString.length);
          if (value === null) {
            rule.conditions.push(new Condition(`true`));
          } else {
            if (value instanceof Date) {
              rule.conditions.push(new Condition(`${reverse ? '!' : ''}(${key}?.getTime() == ${Condition.INITIAL_VALUE_VAR}?.getTime())`, value));
            } else {
              rule.conditions.push(new Condition(`${reverse ? '!' : ''}(${key} == ${value})`));
            }
          }          
        }

        if (name.indexOf('type ') === 0) {
          let conditionString = 'type ';
          const reverse = name.indexOf('type not ') === 0;          
          if (reverse) {
            conditionString += 'not ';
          }

          const key = rawName.substring(conditionString.length);
          if (value === null) {
            rule.conditions.push(new Condition(`true`));
          } else {
            if (value.toLowerCase() === 'date') {
              rule.conditions.push(new Condition(`${reverse ? '!' : ''}(Object.prototype.toString.call(${key}) === '[object Date]')`));
            } else {
              rule.conditions.push(new Condition(`${reverse ? '!' : ''}(typeof ${key} == ${Condition.INITIAL_VALUE_VAR})`, value));
            }            
          } 
        }

        if (name === 'condition') {
          if (value === null) {
            rule.conditions.push(new Condition(`true`));
          } else {
            rule.conditions.push(new Condition(value));
          }          
          return;
        }

        if (name.indexOf('set ') === 0) {
          const key = rawName.substring('set '.length);
          if (value !== null) {
            if (value instanceof Date) {
              rule.actions.push(new Action(`${key} = ${Action.INITIAL_VALUE_VAR}`, value));
            } else {
              rule.actions.push(new Action(`${key} = ${value}`));
            }            
          }
        }

        if (name === 'action') {
          if (value !== null) {
            rule.actions.push(new Action(value));
          }
        }
      },
      () => {
        // only rules with name and at least one action, break or error point should participate in logic
        if (rule.name && (rule.actions.length || rule.break || rule.error)) {
          rules.push(rule);
        }
        rule = new Rule();
      }
    );

    this.log(`Finished reading "${worksheet.name}" worksheet, found ${rules.length} rules(s)`);

    this.steps.push(new Step(worksheet.name, rules));
  }

  /**
   * Read worksheet rows
   * Note: all keys are in lowercase
   * @param worksheet 
   * @param requiredColumns
   * @param forEachCell
   * @param forEachRowEnd
   * @returns 
   */
  private readWorksheet(
    worksheet: Worksheet, 
    requiredColumns: string[], 
    forEachCell: (name: string, value: any, rawName: string) => void, 
    forEachRowEnd: () => void,
  ): void {
    const keys: string[] = [];
    const rawKeys: string[] = [];

    if (worksheet.rowCount === 0) {
      throw new Error(`Worksheet "${worksheet.name}" is empty`);
    }

    worksheet.eachRow((worksheetRow, rowNumber) => {
      if (rowNumber === 1) {
        worksheetRow.eachCell((cell, colNumber) => {
          const key = cell.value.toString().trim();
          keys[colNumber - 1] = key.toLowerCase();
          rawKeys[colNumber - 1] = key;
        });

        requiredColumns.forEach(columnName => {
          if (keys.indexOf(columnName.toLowerCase()) < 0) {
            throw new Error(`Worksheet "${worksheet.name}" is missing required column "${columnName}"`);
          }
        });
      } else {
        const row: Record<string, any> = {};
        for (let i = 0; i < rawKeys.length; i++) {
          const rawKey = rawKeys[i];
          if (rawKey) {
            const key = keys[i];
            const cell = worksheetRow.getCell(i + 1);

            forEachCell(key, cell.value, rawKey);
          }
        }
        worksheetRow.eachCell((cell, colNumber) => {
          
        });

        forEachRowEnd();
      }
    });    
  }
}