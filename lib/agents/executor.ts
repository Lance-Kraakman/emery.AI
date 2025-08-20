/**
 * Agent workflow execution system for NextJS.
 * Spawns emery-agents uv package as subprocess for agent execution.
 */

import { spawn } from 'child_process';
import { db } from '@/lib/db/client';
import { tasks } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

export interface AgentCapabilityRequest {
  agent: any; // Agent from database
  capabilityName: string;
  triggerData: Record<string, any>;
  stepOverrides?: Array<Record<string, any>>;
  executionId: string;
}

export interface AgentCapabilityResult {
  success: boolean;
  execution_id: string;
  capability_name: string;
  status: string;
  output_data?: any;
  error?: string;
  step_executions?: Array<{
    step_id: string;
    step_type: string;
    status: string;
    output_data?: any;
    error_message?: string;
  }>;
}

/**
 * Execute an agent capability using the emery-agents uv package.
 * 
 * This function:
 * 1. Serializes agent configuration and trigger data
 * 2. Spawns emery-agents as subprocess with capability name
 * 3. Tracks execution in database using Task model
 * 4. Returns execution results with step executions
 */
export async function executeAgentCapability(
  request: AgentCapabilityRequest
): Promise<AgentCapabilityResult> {
  const { agent, capabilityName, triggerData, stepOverrides, executionId } = request;
  
  console.log(`[CAPABILITY] Starting execution ${executionId} for agent ${agent.id} capability '${capabilityName}'`);
  
  try {
    // Record task start in database
    await db.insert(tasks).values({
      id: executionId,
      agentId: agent.id,
      organizationId: agent.organizationId!, // Get from agent for RLS
      name: `Capability execution: ${capabilityName}`,
      capabilityName: capabilityName,
      status: 'in_progress',
      instructions: {},
      startedAt: new Date(),
      createdBy: agent.ownerId,
    });
    
    // Prepare environment variables for subprocess
    const env = {
      ...process.env,
      EMERY_API_URL: process.env.NEXTAUTH_URL || 'http://localhost:3000',
      EMERY_AGENT_ID: agent.id.toString(),
      EMERY_AGENT_CONFIG: JSON.stringify(agent),
      EMERY_TRIGGER_DATA: JSON.stringify(triggerData),
      EMERY_STEP_OVERRIDES: JSON.stringify(stepOverrides || []),
      EMERY_EXECUTION_ID: executionId,
      EMERY_CAPABILITY_NAME: capabilityName,
    };
    
    // Spawn emery-agents subprocess with capability name
    const result = await new Promise<AgentCapabilityResult>((resolve, reject) => {
      let output = '';
      let errorOutput = '';
      
      const process = spawn('uv', ['run', 'emery-agents', 'execute', agent.id.toString(), capabilityName], {
        stdio: 'pipe',
        env,
        cwd: '/Users/lancekraakman/orchastrate', // AIDEV-TODO: Make this configurable
      });      
      
      // Collect stdout
      process.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      // Collect stderr
      process.stderr.on('data', (data) => {
        errorOutput += data.toString();
        console.error(`[WORKFLOW-ERROR] ${executionId}:`, data.toString());
      });
      
      // Handle process completion
      process.on('close', async (code) => {
        console.log(`[CAPABILITY] Process ${executionId} exited with code ${code}`);
        
        try {
          if (code === 0 && output.trim()) {
            // Parse successful execution result
            const result = JSON.parse(output.trim());
            
            // Update database with results
            await db.update(tasks)
              .set({
                status: result.status || 'completed',
                result: result.output_data,
                error: result.error_message,
                completedAt: new Date(),
              })
              .where(eq(tasks.id, executionId));
            
            resolve({
              success: true,
              execution_id: executionId,
              capability_name: capabilityName,
              status: result.status || 'completed',
              output_data: result.output_data,
              step_executions: result.step_executions,
            });
          } else {
            // Handle execution failure
            const errorMessage = errorOutput || output || `Process exited with code ${code}`;
            
            // Update database with error
            await db.update(tasks)
              .set({
                status: 'failed',
                error: errorMessage,
                completedAt: new Date(),
              })
              .where(eq(tasks.id, executionId));
            
            resolve({
              success: false,
              execution_id: executionId,
              capability_name: capabilityName,
              status: 'failed',
              error: errorMessage,
            });
          }
        } catch (parseError) {
          console.error(`[CAPABILITY-PARSE-ERROR] ${executionId}:`, parseError);
          
          // Update database with parse error
          await db.update(tasks)
            .set({
              status: 'failed',
              error: `Failed to parse execution result: ${parseError}`,
              completedAt: new Date(),
            })
            .where(eq(tasks.id, executionId));
          
          resolve({
            success: false,
            execution_id: executionId,
            capability_name: capabilityName,
            status: 'failed', 
            error: `Failed to parse execution result: ${parseError}`,
          });
        }
      });
      
      // Handle process errors
      process.on('error', async (error) => {
        console.error(`[CAPABILITY-SPAWN-ERROR] ${executionId}:`, error);
        
        // Update database with spawn error
        await db.update(tasks)
          .set({
            status: 'failed',
            error: `Failed to spawn agent process: ${error.message}`,
            completedAt: new Date(),
          })
          .where(eq(tasks.id, executionId));
        
        resolve({
          success: false,
          execution_id: executionId,
          capability_name: capabilityName,
          status: 'failed',
          error: `Failed to spawn agent process: ${error.message}`,
        });
      });
      
      // Set timeout for long-running processes
      const timeout = setTimeout(() => {
        console.log(`[CAPABILITY-TIMEOUT] ${executionId}: Killing process after timeout`);
        process.kill('SIGKILL');
      }, 300000); // 5 minutes timeout
      
      // Clear timeout when process completes
      process.on('close', () => clearTimeout(timeout));
    });
    
    console.log(`[CAPABILITY] Execution ${executionId} completed:`, result.status);
    return result;
    
  } catch (error) {
    console.error(`[CAPABILITY-ERROR] ${executionId}:`, error);
    
    // Update database with error
    try {
      await db.update(tasks)
        .set({
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
          completedAt: new Date(),
        })
        .where(eq(tasks.id, executionId));
    } catch (dbError) {
      console.error(`[CAPABILITY-DB-ERROR] ${executionId}:`, dbError);
    }
    
    return {
      success: false,
      execution_id: executionId,
      capability_name: capabilityName,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get task status from database.
 */
export async function getTask(taskId: string) {
  const [task] = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1);
  
  return task;
}

/**
 * List tasks for a specific agent.
 */
export async function listTasks(agentId: number, limit = 50) {
  const tasks_list = await db
    .select()
    .from(tasks)
    .where(eq(tasks.agentId, agentId))
    .orderBy(desc(tasks.startedAt))
    .limit(limit);
  
  return tasks_list;
}


// AIDEV-NOTE: This bridges NextJS with the emery-agents Python package for capability execution
// AIDEV-TODO: Add support for real-time task execution status updates via WebSocket
// AIDEV-TODO: Implement task execution cancellation mechanism
// AIDEV-QUESTION: Should we support distributed capability execution across multiple workers?
