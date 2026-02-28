import { createProgram } from '@/cli/program';

// 如果直接运行此文件，则启动 CLI 程序
if (require.main === module) {
  createProgram().parseAsync(process.argv).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}