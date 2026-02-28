import { createProgram } from '@/cli/program';

createProgram().parseAsync(process.argv).catch((err) => {
  console.error(err);
  process.exit(1);
});
