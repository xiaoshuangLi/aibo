import { createProgram } from '@/cli/program';

// 如果直接运行此文件，则启动主函数
if (require.main === module) {
  createProgram().parseAsync(process.argv).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}