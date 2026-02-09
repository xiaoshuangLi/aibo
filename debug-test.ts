// Debug test to see actual output
import { styled } from '../src/utils/interactive-utils';

console.log('Actual output:');
console.log(styled.toolCall('testTool', { param: 'value' }));
console.log('End actual output');