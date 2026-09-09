export class WorkflowEntrypoint<E = any, P = any> {
  env: E;
  ctx: any;
  constructor(ctx: any, env: E) {
    this.ctx = ctx;
    this.env = env;
  }
}
export class WorkflowStep {}
export class WorkflowEvent {}
