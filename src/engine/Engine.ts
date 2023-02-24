import { Workbook, Worksheet } from "exceljs";
import { Action, Condition, Rule, Step } from "../models";

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
   */
  public async init(rulesFilePath: string): Promise<void> {
    for (const key of Object.keys(this.context)) {
      delete this.context[key];
    };
    this.steps.splice(0, this.steps.length);

    await this.readExcelFile(rulesFilePath);    
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
  ): Promise<{
    result: Record<string, any>,
    context: Record<string, any>,
    fact: Record<string, any>,
  }> {
    const result: Record<string, any> = {};

    // create a copy of the context and fact
    const context = JSON.parse(JSON.stringify({
      ...this.context,
      ...(extraContextVariables ?? {})
    }));
    fact = JSON.parse(JSON.stringify(fact));

    for (const step of this.steps) {
      this.log(`Processing step "${step.name}"...`);
      let breakPoint = false;
      for (const rule of step.rules) {
        this.log(`Processing step "${step.name}" rule "${rule.name}"...`);
        let apply = true;
        for (const condition of rule.conditions) {
          apply = condition.process(context, fact, result);
          if (!apply) {
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
        }
      }   
      
      if (breakPoint) {
        break;
      }
    }

    return {
      result,
      context,
      fact
    };
  }

  /**
   * Read Excel file and generate step definitions
   * @param rulesFilePath 
   */
  private async readExcelFile(rulesFilePath: string): Promise<void> {
    this.log(`Reading excel file ${rulesFilePath}`);
    const workbook = await new Workbook().xlsx.readFile(rulesFilePath);

    workbook.eachSheet((worksheet: Worksheet) => {
      const name = worksheet.name.toLowerCase().trim();
      if (name === 'context') {
        this.readContextWorksheet(worksheet);
        
        return;
      }

      /* istanbul ignore else */
      if (name.indexOf('step') === 0) { 
        this.readStepWorksheet(worksheet);

        return;
      }
    });

    // steps should be alphabetically sorted
    this.steps.sort((a, b) => {
      return a.name.toLowerCase().trim().localeCompare(b.name.toLowerCase().trim());
    });

    this.log(`Finished reading excel file, found ${this.steps.length} step(s)`);
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

        if (name.indexOf('if ') === 0) {
          const key = rawName.substring(3);
          if (value === null) {
            rule.conditions.push(new Condition(`true`));
          } else {
            rule.conditions.push(new Condition(`${key} == ${value}`));
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
          const key = rawName.substring(3);
          if (value !== null) {
            rule.actions.push(new Action(`${key} = ${value}`));
          }
        }

        if (name === 'action') {
          if (value !== null) {
            rule.actions.push(new Action(value));
          }
        }
      },
      () => {
        // only rules with name and at least one action or break point should participate in logic
        if (rule.name && (rule.actions.length || rule.break)) {
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