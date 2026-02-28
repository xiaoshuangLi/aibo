/**
 * Restart Helper Utilities
 * 
 * This module provides utilities for detecting the current runtime environment
 * and creating appropriate restart commands for both ts-node and compiled Node.js environments.
 */

/**
 * Detects if the current process is running under ts-node
 * @returns boolean - true if running under ts-node, false otherwise
 */
export function isRunningInTsNode(): boolean {
  // Check for ts-node specific symbols
  const tsNodeSymbol = Symbol.for('ts-node.register.instance');
  if (tsNodeSymbol in process && typeof (process as any)[tsNodeSymbol] !== 'undefined') {
    return true;
  }
  
  // Check for ts-node environment variables
  if (process.env.TS_NODE_DEV !== undefined) {
    return true;
  }
  
  // Check if any execArgv contains ts-node
  if (process.execArgv.some(arg => arg.includes('ts-node'))) {
    return true;
  }
  
  // Check if the main entry file is a TypeScript file
  const mainFile = process.argv[1];
  if (mainFile && mainFile.endsWith('.ts')) {
    return true;
  }
  
  return false;
}

/**
 * Gets the appropriate restart command and arguments based on current environment
 * @returns { restartCommand: string, restartArgs: string[] } - Command and arguments for restart
 */
export function getRestartCommand(): { restartCommand: string; restartArgs: string[] } {
  const isTsNode = isRunningInTsNode();
  
  if (isTsNode) {
    // In ts-node environment, use ts-node with proper registration
    const restartCommand = 'node';
    const tsNodeArgs = ['-r', 'tsconfig-paths/register'];
    
    // Find the main TypeScript file from process.argv
    let mainScript = process.argv.find(arg => arg.endsWith('.ts'));
    if (!mainScript) {
      // Fallback to default main file
      mainScript = 'src/main.ts';
    }
    
    const restartArgs = [
      ...tsNodeArgs,
      'node_modules/ts-node/dist/bin.js',
      mainScript,
      ...process.argv.slice(2)
    ];
    
    return { restartCommand, restartArgs };
  } else {
    // In compiled Node.js environment, use current process args
    return {
      restartCommand: process.argv[0],
      restartArgs: process.argv.slice(1)
    };
  }
}