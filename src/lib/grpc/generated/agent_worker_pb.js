// source: agent_worker.proto
/**
 * @fileoverview
 * @enhanceable
 * @suppress {missingRequire} reports error on implicit type usages.
 * @suppress {messageConventions} JS Compiler reports an error if a variable or
 *     field starts with 'MSG_' and isn't a translatable message.
 * @public
 */
// GENERATED CODE -- DO NOT EDIT!
/* eslint-disable */
// @ts-nocheck

var jspb = require('google-protobuf');
var goog = jspb;
var global = (function() {
  if (this) { return this; }
  if (typeof window !== 'undefined') { return window; }
  if (typeof global !== 'undefined') { return global; }
  if (typeof self !== 'undefined') { return self; }
  return Function('return this')();
}.call(null));

goog.exportSymbol('proto.emery.agents.AgentConfig', null, global);
goog.exportSymbol('proto.emery.agents.CancelMessageRequest', null, global);
goog.exportSymbol('proto.emery.agents.CancelMessageResponse', null, global);
goog.exportSymbol('proto.emery.agents.CancelTaskRequest', null, global);
goog.exportSymbol('proto.emery.agents.CancelTaskResponse', null, global);
goog.exportSymbol('proto.emery.agents.ChatContext', null, global);
goog.exportSymbol('proto.emery.agents.ContentChunk', null, global);
goog.exportSymbol('proto.emery.agents.Empty', null, global);
goog.exportSymbol('proto.emery.agents.ErrorConfig', null, global);
goog.exportSymbol('proto.emery.agents.ErrorResponse', null, global);
goog.exportSymbol('proto.emery.agents.FieldMapping', null, global);
goog.exportSymbol('proto.emery.agents.FieldSource', null, global);
goog.exportSymbol('proto.emery.agents.FieldSource.SourceCase', null, global);
goog.exportSymbol('proto.emery.agents.FileAttachment', null, global);
goog.exportSymbol('proto.emery.agents.FilePart', null, global);
goog.exportSymbol('proto.emery.agents.HistoryMessage', null, global);
goog.exportSymbol('proto.emery.agents.ImageAttachment', null, global);
goog.exportSymbol('proto.emery.agents.ImageUrlPart', null, global);
goog.exportSymbol('proto.emery.agents.InputDefinition', null, global);
goog.exportSymbol('proto.emery.agents.InputFieldSource', null, global);
goog.exportSymbol('proto.emery.agents.InputMappingConfig', null, global);
goog.exportSymbol('proto.emery.agents.InstructionConfig', null, global);
goog.exportSymbol('proto.emery.agents.LoopConfig', null, global);
goog.exportSymbol('proto.emery.agents.MessagePart', null, global);
goog.exportSymbol('proto.emery.agents.MessagePart.PartCase', null, global);
goog.exportSymbol('proto.emery.agents.OutputDefinition', null, global);
goog.exportSymbol('proto.emery.agents.OutputMappingConfig', null, global);
goog.exportSymbol('proto.emery.agents.OutputSource', null, global);
goog.exportSymbol('proto.emery.agents.ProcessMessageRequest', null, global);
goog.exportSymbol('proto.emery.agents.ProcessMessageResponse', null, global);
goog.exportSymbol('proto.emery.agents.ProcessMessageResponse.ResponseCase', null, global);
goog.exportSymbol('proto.emery.agents.ProcessingComplete', null, global);
goog.exportSymbol('proto.emery.agents.ProcessingError', null, global);
goog.exportSymbol('proto.emery.agents.QueryFilter', null, global);
goog.exportSymbol('proto.emery.agents.ReadConfig', null, global);
goog.exportSymbol('proto.emery.agents.ReadFieldMapping', null, global);
goog.exportSymbol('proto.emery.agents.RetryConfig', null, global);
goog.exportSymbol('proto.emery.agents.RowIdSource', null, global);
goog.exportSymbol('proto.emery.agents.RowIdSource.SourceCase', null, global);
goog.exportSymbol('proto.emery.agents.ServerConfig', null, global);
goog.exportSymbol('proto.emery.agents.SkillConfig', null, global);
goog.exportSymbol('proto.emery.agents.SkillInputValue', null, global);
goog.exportSymbol('proto.emery.agents.SkillInputValue.ValueCase', null, global);
goog.exportSymbol('proto.emery.agents.SkillStep', null, global);
goog.exportSymbol('proto.emery.agents.StepOutput', null, global);
goog.exportSymbol('proto.emery.agents.StepProgress', null, global);
goog.exportSymbol('proto.emery.agents.StepType', null, global);
goog.exportSymbol('proto.emery.agents.TableMapping', null, global);
goog.exportSymbol('proto.emery.agents.TableReference', null, global);
goog.exportSymbol('proto.emery.agents.TargetFieldMetadata', null, global);
goog.exportSymbol('proto.emery.agents.TaskModelConfig', null, global);
goog.exportSymbol('proto.emery.agents.TaskProgress', null, global);
goog.exportSymbol('proto.emery.agents.TaskRequest', null, global);
goog.exportSymbol('proto.emery.agents.TaskRequest.ExecutionModeCase', null, global);
goog.exportSymbol('proto.emery.agents.TaskStatus', null, global);
goog.exportSymbol('proto.emery.agents.TextPart', null, global);
goog.exportSymbol('proto.emery.agents.TokenUsage', null, global);
goog.exportSymbol('proto.emery.agents.ToolConfig', null, global);
goog.exportSymbol('proto.emery.agents.ToolExecutionConfig', null, global);
goog.exportSymbol('proto.emery.agents.ToolInputMapping', null, global);
goog.exportSymbol('proto.emery.agents.TriggerData', null, global);
goog.exportSymbol('proto.emery.agents.UpdateMatchConfig', null, global);
goog.exportSymbol('proto.emery.agents.WorkerInfo', null, global);
goog.exportSymbol('proto.emery.agents.WorkerStatus', null, global);
goog.exportSymbol('proto.emery.agents.WriteConfig', null, global);
goog.exportSymbol('proto.emery.agents.WriteFieldMapping', null, global);
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.emery.agents.TaskRequest = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, proto.emery.agents.TaskRequest.repeatedFields_, proto.emery.agents.TaskRequest.oneofGroups_);
};
goog.inherits(proto.emery.agents.TaskRequest, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.emery.agents.TaskRequest.displayName = 'proto.emery.agents.TaskRequest';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.emery.agents.TaskProgress = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.emery.agents.TaskProgress, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.emery.agents.TaskProgress.displayName = 'proto.emery.agents.TaskProgress';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.emery.agents.CancelTaskRequest = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.emery.agents.CancelTaskRequest, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.emery.agents.CancelTaskRequest.displayName = 'proto.emery.agents.CancelTaskRequest';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.emery.agents.CancelTaskResponse = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.emery.agents.CancelTaskResponse, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.emery.agents.CancelTaskResponse.displayName = 'proto.emery.agents.CancelTaskResponse';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.emery.agents.WorkerInfo = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, proto.emery.agents.WorkerInfo.repeatedFields_, null);
};
goog.inherits(proto.emery.agents.WorkerInfo, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.emery.agents.WorkerInfo.displayName = 'proto.emery.agents.WorkerInfo';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.emery.agents.Empty = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.emery.agents.Empty, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.emery.agents.Empty.displayName = 'proto.emery.agents.Empty';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.emery.agents.ErrorResponse = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.emery.agents.ErrorResponse, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.emery.agents.ErrorResponse.displayName = 'proto.emery.agents.ErrorResponse';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.emery.agents.TokenUsage = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.emery.agents.TokenUsage, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.emery.agents.TokenUsage.displayName = 'proto.emery.agents.TokenUsage';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.emery.agents.AgentConfig = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, proto.emery.agents.AgentConfig.repeatedFields_, null);
};
goog.inherits(proto.emery.agents.AgentConfig, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.emery.agents.AgentConfig.displayName = 'proto.emery.agents.AgentConfig';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.emery.agents.SkillConfig = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, proto.emery.agents.SkillConfig.repeatedFields_, null);
};
goog.inherits(proto.emery.agents.SkillConfig, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.emery.agents.SkillConfig.displayName = 'proto.emery.agents.SkillConfig';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.emery.agents.InputFieldSource = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.emery.agents.InputFieldSource, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.emery.agents.InputFieldSource.displayName = 'proto.emery.agents.InputFieldSource';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.emery.agents.InputMappingConfig = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.emery.agents.InputMappingConfig, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.emery.agents.InputMappingConfig.displayName = 'proto.emery.agents.InputMappingConfig';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.emery.agents.InputDefinition = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.emery.agents.InputDefinition, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.emery.agents.InputDefinition.displayName = 'proto.emery.agents.InputDefinition';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.emery.agents.OutputSource = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.emery.agents.OutputSource, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.emery.agents.OutputSource.displayName = 'proto.emery.agents.OutputSource';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.emery.agents.OutputDefinition = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.emery.agents.OutputDefinition, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.emery.agents.OutputDefinition.displayName = 'proto.emery.agents.OutputDefinition';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.emery.agents.ErrorConfig = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.emery.agents.ErrorConfig, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.emery.agents.ErrorConfig.displayName = 'proto.emery.agents.ErrorConfig';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.emery.agents.RetryConfig = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.emery.agents.RetryConfig, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.emery.agents.RetryConfig.displayName = 'proto.emery.agents.RetryConfig';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.emery.agents.StepOutput = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, proto.emery.agents.StepOutput.repeatedFields_, null);
};
goog.inherits(proto.emery.agents.StepOutput, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.emery.agents.StepOutput.displayName = 'proto.emery.agents.StepOutput';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.emery.agents.LoopConfig = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.emery.agents.LoopConfig, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.emery.agents.LoopConfig.displayName = 'proto.emery.agents.LoopConfig';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.emery.agents.SkillStep = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, proto.emery.agents.SkillStep.repeatedFields_, null);
};
goog.inherits(proto.emery.agents.SkillStep, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.emery.agents.SkillStep.displayName = 'proto.emery.agents.SkillStep';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.emery.agents.TaskModelConfig = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.emery.agents.TaskModelConfig, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.emery.agents.TaskModelConfig.displayName = 'proto.emery.agents.TaskModelConfig';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.emery.agents.ToolExecutionConfig = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, proto.emery.agents.ToolExecutionConfig.repeatedFields_, null);
};
goog.inherits(proto.emery.agents.ToolExecutionConfig, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.emery.agents.ToolExecutionConfig.displayName = 'proto.emery.agents.ToolExecutionConfig';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.emery.agents.ToolInputMapping = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.emery.agents.ToolInputMapping, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.emery.agents.ToolInputMapping.displayName = 'proto.emery.agents.ToolInputMapping';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.emery.agents.WriteConfig = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, proto.emery.agents.WriteConfig.repeatedFields_, null);
};
goog.inherits(proto.emery.agents.WriteConfig, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.emery.agents.WriteConfig.displayName = 'proto.emery.agents.WriteConfig';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.emery.agents.WriteFieldMapping = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.emery.agents.WriteFieldMapping, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.emery.agents.WriteFieldMapping.displayName = 'proto.emery.agents.WriteFieldMapping';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.emery.agents.UpdateMatchConfig = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.emery.agents.UpdateMatchConfig, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.emery.agents.UpdateMatchConfig.displayName = 'proto.emery.agents.UpdateMatchConfig';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.emery.agents.ReadConfig = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, proto.emery.agents.ReadConfig.repeatedFields_, null);
};
goog.inherits(proto.emery.agents.ReadConfig, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.emery.agents.ReadConfig.displayName = 'proto.emery.agents.ReadConfig';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.emery.agents.QueryFilter = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.emery.agents.QueryFilter, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.emery.agents.QueryFilter.displayName = 'proto.emery.agents.QueryFilter';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.emery.agents.ReadFieldMapping = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.emery.agents.ReadFieldMapping, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.emery.agents.ReadFieldMapping.displayName = 'proto.emery.agents.ReadFieldMapping';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.emery.agents.TargetFieldMetadata = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, proto.emery.agents.TargetFieldMetadata.repeatedFields_, null);
};
goog.inherits(proto.emery.agents.TargetFieldMetadata, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.emery.agents.TargetFieldMetadata.displayName = 'proto.emery.agents.TargetFieldMetadata';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.emery.agents.TableReference = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.emery.agents.TableReference, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.emery.agents.TableReference.displayName = 'proto.emery.agents.TableReference';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.emery.agents.FieldSource = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, proto.emery.agents.FieldSource.oneofGroups_);
};
goog.inherits(proto.emery.agents.FieldSource, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.emery.agents.FieldSource.displayName = 'proto.emery.agents.FieldSource';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.emery.agents.RowIdSource = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, proto.emery.agents.RowIdSource.oneofGroups_);
};
goog.inherits(proto.emery.agents.RowIdSource, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.emery.agents.RowIdSource.displayName = 'proto.emery.agents.RowIdSource';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.emery.agents.FieldMapping = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.emery.agents.FieldMapping, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.emery.agents.FieldMapping.displayName = 'proto.emery.agents.FieldMapping';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.emery.agents.TableMapping = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, proto.emery.agents.TableMapping.repeatedFields_, null);
};
goog.inherits(proto.emery.agents.TableMapping, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.emery.agents.TableMapping.displayName = 'proto.emery.agents.TableMapping';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.emery.agents.OutputMappingConfig = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, proto.emery.agents.OutputMappingConfig.repeatedFields_, null);
};
goog.inherits(proto.emery.agents.OutputMappingConfig, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.emery.agents.OutputMappingConfig.displayName = 'proto.emery.agents.OutputMappingConfig';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.emery.agents.ToolConfig = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.emery.agents.ToolConfig, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.emery.agents.ToolConfig.displayName = 'proto.emery.agents.ToolConfig';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.emery.agents.ServerConfig = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.emery.agents.ServerConfig, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.emery.agents.ServerConfig.displayName = 'proto.emery.agents.ServerConfig';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.emery.agents.SkillInputValue = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, proto.emery.agents.SkillInputValue.oneofGroups_);
};
goog.inherits(proto.emery.agents.SkillInputValue, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.emery.agents.SkillInputValue.displayName = 'proto.emery.agents.SkillInputValue';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.emery.agents.TriggerData = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, proto.emery.agents.TriggerData.repeatedFields_, null);
};
goog.inherits(proto.emery.agents.TriggerData, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.emery.agents.TriggerData.displayName = 'proto.emery.agents.TriggerData';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.emery.agents.InstructionConfig = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, proto.emery.agents.InstructionConfig.repeatedFields_, null);
};
goog.inherits(proto.emery.agents.InstructionConfig, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.emery.agents.InstructionConfig.displayName = 'proto.emery.agents.InstructionConfig';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.emery.agents.ImageAttachment = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.emery.agents.ImageAttachment, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.emery.agents.ImageAttachment.displayName = 'proto.emery.agents.ImageAttachment';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.emery.agents.FileAttachment = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.emery.agents.FileAttachment, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.emery.agents.FileAttachment.displayName = 'proto.emery.agents.FileAttachment';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.emery.agents.ProcessMessageRequest = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, proto.emery.agents.ProcessMessageRequest.repeatedFields_, null);
};
goog.inherits(proto.emery.agents.ProcessMessageRequest, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.emery.agents.ProcessMessageRequest.displayName = 'proto.emery.agents.ProcessMessageRequest';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.emery.agents.ProcessMessageResponse = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, proto.emery.agents.ProcessMessageResponse.oneofGroups_);
};
goog.inherits(proto.emery.agents.ProcessMessageResponse, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.emery.agents.ProcessMessageResponse.displayName = 'proto.emery.agents.ProcessMessageResponse';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.emery.agents.MessagePart = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, proto.emery.agents.MessagePart.oneofGroups_);
};
goog.inherits(proto.emery.agents.MessagePart, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.emery.agents.MessagePart.displayName = 'proto.emery.agents.MessagePart';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.emery.agents.TextPart = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.emery.agents.TextPart, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.emery.agents.TextPart.displayName = 'proto.emery.agents.TextPart';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.emery.agents.ImageUrlPart = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.emery.agents.ImageUrlPart, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.emery.agents.ImageUrlPart.displayName = 'proto.emery.agents.ImageUrlPart';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.emery.agents.FilePart = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.emery.agents.FilePart, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.emery.agents.FilePart.displayName = 'proto.emery.agents.FilePart';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.emery.agents.HistoryMessage = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, proto.emery.agents.HistoryMessage.repeatedFields_, null);
};
goog.inherits(proto.emery.agents.HistoryMessage, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.emery.agents.HistoryMessage.displayName = 'proto.emery.agents.HistoryMessage';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.emery.agents.ContentChunk = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.emery.agents.ContentChunk, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.emery.agents.ContentChunk.displayName = 'proto.emery.agents.ContentChunk';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.emery.agents.ProcessingComplete = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.emery.agents.ProcessingComplete, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.emery.agents.ProcessingComplete.displayName = 'proto.emery.agents.ProcessingComplete';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.emery.agents.ProcessingError = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.emery.agents.ProcessingError, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.emery.agents.ProcessingError.displayName = 'proto.emery.agents.ProcessingError';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.emery.agents.StepProgress = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.emery.agents.StepProgress, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.emery.agents.StepProgress.displayName = 'proto.emery.agents.StepProgress';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.emery.agents.CancelMessageRequest = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.emery.agents.CancelMessageRequest, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.emery.agents.CancelMessageRequest.displayName = 'proto.emery.agents.CancelMessageRequest';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.emery.agents.CancelMessageResponse = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.emery.agents.CancelMessageResponse, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.emery.agents.CancelMessageResponse.displayName = 'proto.emery.agents.CancelMessageResponse';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.emery.agents.ChatContext = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.emery.agents.ChatContext, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.emery.agents.ChatContext.displayName = 'proto.emery.agents.ChatContext';
}

/**
 * List of repeated fields within this message type.
 * @private {!Array<number>}
 * @const
 */
proto.emery.agents.TaskRequest.repeatedFields_ = [13];

/**
 * Oneof group definitions for this message. Each group defines the field
 * numbers belonging to that group. When of these fields' value is set, all
 * other fields in the group are cleared. During deserialization, if multiple
 * fields are encountered for a group, only the last value seen will be kept.
 * @private {!Array<!Array<number>>}
 * @const
 */
proto.emery.agents.TaskRequest.oneofGroups_ = [[3,9]];

/**
 * @enum {number}
 */
proto.emery.agents.TaskRequest.ExecutionModeCase = {
  EXECUTION_MODE_NOT_SET: 0,
  SKILL_NAME: 3,
  INSTRUCTION_CONFIG: 9
};

/**
 * @return {proto.emery.agents.TaskRequest.ExecutionModeCase}
 */
proto.emery.agents.TaskRequest.prototype.getExecutionModeCase = function() {
  return /** @type {proto.emery.agents.TaskRequest.ExecutionModeCase} */(jspb.Message.computeOneofCase(this, proto.emery.agents.TaskRequest.oneofGroups_[0]));
};



if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.emery.agents.TaskRequest.prototype.toObject = function(opt_includeInstance) {
  return proto.emery.agents.TaskRequest.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.emery.agents.TaskRequest} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.TaskRequest.toObject = function(includeInstance, msg) {
  var f, obj = {
    taskId: jspb.Message.getFieldWithDefault(msg, 1, ""),
    agentId: jspb.Message.getFieldWithDefault(msg, 2, 0),
    skillName: jspb.Message.getFieldWithDefault(msg, 3, ""),
    instructionConfig: (f = msg.getInstructionConfig()) && proto.emery.agents.InstructionConfig.toObject(includeInstance, f),
    agentConfig: (f = msg.getAgentConfig()) && proto.emery.agents.AgentConfig.toObject(includeInstance, f),
    triggerData: (f = msg.getTriggerData()) && proto.emery.agents.TriggerData.toObject(includeInstance, f),
    organizationId: jspb.Message.getFieldWithDefault(msg, 6, ""),
    ownerId: jspb.Message.getFieldWithDefault(msg, 7, ""),
    timeoutSeconds: jspb.Message.getFieldWithDefault(msg, 8, 0),
    name: jspb.Message.getFieldWithDefault(msg, 10, ""),
    agentModel: jspb.Message.getFieldWithDefault(msg, 11, ""),
    organizationModel: jspb.Message.getFieldWithDefault(msg, 12, ""),
    inputContentList: jspb.Message.toObjectList(msg.getInputContentList(),
    proto.emery.agents.MessagePart.toObject, includeInstance)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.emery.agents.TaskRequest}
 */
proto.emery.agents.TaskRequest.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.emery.agents.TaskRequest;
  return proto.emery.agents.TaskRequest.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.emery.agents.TaskRequest} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.emery.agents.TaskRequest}
 */
proto.emery.agents.TaskRequest.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setTaskId(value);
      break;
    case 2:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setAgentId(value);
      break;
    case 3:
      var value = /** @type {string} */ (reader.readString());
      msg.setSkillName(value);
      break;
    case 9:
      var value = new proto.emery.agents.InstructionConfig;
      reader.readMessage(value,proto.emery.agents.InstructionConfig.deserializeBinaryFromReader);
      msg.setInstructionConfig(value);
      break;
    case 4:
      var value = new proto.emery.agents.AgentConfig;
      reader.readMessage(value,proto.emery.agents.AgentConfig.deserializeBinaryFromReader);
      msg.setAgentConfig(value);
      break;
    case 5:
      var value = new proto.emery.agents.TriggerData;
      reader.readMessage(value,proto.emery.agents.TriggerData.deserializeBinaryFromReader);
      msg.setTriggerData(value);
      break;
    case 6:
      var value = /** @type {string} */ (reader.readString());
      msg.setOrganizationId(value);
      break;
    case 7:
      var value = /** @type {string} */ (reader.readString());
      msg.setOwnerId(value);
      break;
    case 8:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setTimeoutSeconds(value);
      break;
    case 10:
      var value = /** @type {string} */ (reader.readString());
      msg.setName(value);
      break;
    case 11:
      var value = /** @type {string} */ (reader.readString());
      msg.setAgentModel(value);
      break;
    case 12:
      var value = /** @type {string} */ (reader.readString());
      msg.setOrganizationModel(value);
      break;
    case 13:
      var value = new proto.emery.agents.MessagePart;
      reader.readMessage(value,proto.emery.agents.MessagePart.deserializeBinaryFromReader);
      msg.addInputContent(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.emery.agents.TaskRequest.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.emery.agents.TaskRequest.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.emery.agents.TaskRequest} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.TaskRequest.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getTaskId();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getAgentId();
  if (f !== 0) {
    writer.writeInt32(
      2,
      f
    );
  }
  f = /** @type {string} */ (jspb.Message.getField(message, 3));
  if (f != null) {
    writer.writeString(
      3,
      f
    );
  }
  f = message.getInstructionConfig();
  if (f != null) {
    writer.writeMessage(
      9,
      f,
      proto.emery.agents.InstructionConfig.serializeBinaryToWriter
    );
  }
  f = message.getAgentConfig();
  if (f != null) {
    writer.writeMessage(
      4,
      f,
      proto.emery.agents.AgentConfig.serializeBinaryToWriter
    );
  }
  f = message.getTriggerData();
  if (f != null) {
    writer.writeMessage(
      5,
      f,
      proto.emery.agents.TriggerData.serializeBinaryToWriter
    );
  }
  f = message.getOrganizationId();
  if (f.length > 0) {
    writer.writeString(
      6,
      f
    );
  }
  f = message.getOwnerId();
  if (f.length > 0) {
    writer.writeString(
      7,
      f
    );
  }
  f = message.getTimeoutSeconds();
  if (f !== 0) {
    writer.writeInt32(
      8,
      f
    );
  }
  f = message.getName();
  if (f.length > 0) {
    writer.writeString(
      10,
      f
    );
  }
  f = message.getAgentModel();
  if (f.length > 0) {
    writer.writeString(
      11,
      f
    );
  }
  f = message.getOrganizationModel();
  if (f.length > 0) {
    writer.writeString(
      12,
      f
    );
  }
  f = message.getInputContentList();
  if (f.length > 0) {
    writer.writeRepeatedMessage(
      13,
      f,
      proto.emery.agents.MessagePart.serializeBinaryToWriter
    );
  }
};


/**
 * optional string task_id = 1;
 * @return {string}
 */
proto.emery.agents.TaskRequest.prototype.getTaskId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.TaskRequest} returns this
 */
proto.emery.agents.TaskRequest.prototype.setTaskId = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional int32 agent_id = 2;
 * @return {number}
 */
proto.emery.agents.TaskRequest.prototype.getAgentId = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 2, 0));
};


/**
 * @param {number} value
 * @return {!proto.emery.agents.TaskRequest} returns this
 */
proto.emery.agents.TaskRequest.prototype.setAgentId = function(value) {
  return jspb.Message.setProto3IntField(this, 2, value);
};


/**
 * optional string skill_name = 3;
 * @return {string}
 */
proto.emery.agents.TaskRequest.prototype.getSkillName = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 3, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.TaskRequest} returns this
 */
proto.emery.agents.TaskRequest.prototype.setSkillName = function(value) {
  return jspb.Message.setOneofField(this, 3, proto.emery.agents.TaskRequest.oneofGroups_[0], value);
};


/**
 * Clears the field making it undefined.
 * @return {!proto.emery.agents.TaskRequest} returns this
 */
proto.emery.agents.TaskRequest.prototype.clearSkillName = function() {
  return jspb.Message.setOneofField(this, 3, proto.emery.agents.TaskRequest.oneofGroups_[0], undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.emery.agents.TaskRequest.prototype.hasSkillName = function() {
  return jspb.Message.getField(this, 3) != null;
};


/**
 * optional InstructionConfig instruction_config = 9;
 * @return {?proto.emery.agents.InstructionConfig}
 */
proto.emery.agents.TaskRequest.prototype.getInstructionConfig = function() {
  return /** @type{?proto.emery.agents.InstructionConfig} */ (
    jspb.Message.getWrapperField(this, proto.emery.agents.InstructionConfig, 9));
};


/**
 * @param {?proto.emery.agents.InstructionConfig|undefined} value
 * @return {!proto.emery.agents.TaskRequest} returns this
*/
proto.emery.agents.TaskRequest.prototype.setInstructionConfig = function(value) {
  return jspb.Message.setOneofWrapperField(this, 9, proto.emery.agents.TaskRequest.oneofGroups_[0], value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.emery.agents.TaskRequest} returns this
 */
proto.emery.agents.TaskRequest.prototype.clearInstructionConfig = function() {
  return this.setInstructionConfig(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.emery.agents.TaskRequest.prototype.hasInstructionConfig = function() {
  return jspb.Message.getField(this, 9) != null;
};


/**
 * optional AgentConfig agent_config = 4;
 * @return {?proto.emery.agents.AgentConfig}
 */
proto.emery.agents.TaskRequest.prototype.getAgentConfig = function() {
  return /** @type{?proto.emery.agents.AgentConfig} */ (
    jspb.Message.getWrapperField(this, proto.emery.agents.AgentConfig, 4));
};


/**
 * @param {?proto.emery.agents.AgentConfig|undefined} value
 * @return {!proto.emery.agents.TaskRequest} returns this
*/
proto.emery.agents.TaskRequest.prototype.setAgentConfig = function(value) {
  return jspb.Message.setWrapperField(this, 4, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.emery.agents.TaskRequest} returns this
 */
proto.emery.agents.TaskRequest.prototype.clearAgentConfig = function() {
  return this.setAgentConfig(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.emery.agents.TaskRequest.prototype.hasAgentConfig = function() {
  return jspb.Message.getField(this, 4) != null;
};


/**
 * optional TriggerData trigger_data = 5;
 * @return {?proto.emery.agents.TriggerData}
 */
proto.emery.agents.TaskRequest.prototype.getTriggerData = function() {
  return /** @type{?proto.emery.agents.TriggerData} */ (
    jspb.Message.getWrapperField(this, proto.emery.agents.TriggerData, 5));
};


/**
 * @param {?proto.emery.agents.TriggerData|undefined} value
 * @return {!proto.emery.agents.TaskRequest} returns this
*/
proto.emery.agents.TaskRequest.prototype.setTriggerData = function(value) {
  return jspb.Message.setWrapperField(this, 5, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.emery.agents.TaskRequest} returns this
 */
proto.emery.agents.TaskRequest.prototype.clearTriggerData = function() {
  return this.setTriggerData(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.emery.agents.TaskRequest.prototype.hasTriggerData = function() {
  return jspb.Message.getField(this, 5) != null;
};


/**
 * optional string organization_id = 6;
 * @return {string}
 */
proto.emery.agents.TaskRequest.prototype.getOrganizationId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 6, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.TaskRequest} returns this
 */
proto.emery.agents.TaskRequest.prototype.setOrganizationId = function(value) {
  return jspb.Message.setProto3StringField(this, 6, value);
};


/**
 * optional string owner_id = 7;
 * @return {string}
 */
proto.emery.agents.TaskRequest.prototype.getOwnerId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 7, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.TaskRequest} returns this
 */
proto.emery.agents.TaskRequest.prototype.setOwnerId = function(value) {
  return jspb.Message.setProto3StringField(this, 7, value);
};


/**
 * optional int32 timeout_seconds = 8;
 * @return {number}
 */
proto.emery.agents.TaskRequest.prototype.getTimeoutSeconds = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 8, 0));
};


/**
 * @param {number} value
 * @return {!proto.emery.agents.TaskRequest} returns this
 */
proto.emery.agents.TaskRequest.prototype.setTimeoutSeconds = function(value) {
  return jspb.Message.setProto3IntField(this, 8, value);
};


/**
 * optional string name = 10;
 * @return {string}
 */
proto.emery.agents.TaskRequest.prototype.getName = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 10, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.TaskRequest} returns this
 */
proto.emery.agents.TaskRequest.prototype.setName = function(value) {
  return jspb.Message.setProto3StringField(this, 10, value);
};


/**
 * optional string agent_model = 11;
 * @return {string}
 */
proto.emery.agents.TaskRequest.prototype.getAgentModel = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 11, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.TaskRequest} returns this
 */
proto.emery.agents.TaskRequest.prototype.setAgentModel = function(value) {
  return jspb.Message.setProto3StringField(this, 11, value);
};


/**
 * optional string organization_model = 12;
 * @return {string}
 */
proto.emery.agents.TaskRequest.prototype.getOrganizationModel = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 12, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.TaskRequest} returns this
 */
proto.emery.agents.TaskRequest.prototype.setOrganizationModel = function(value) {
  return jspb.Message.setProto3StringField(this, 12, value);
};


/**
 * repeated MessagePart input_content = 13;
 * @return {!Array<!proto.emery.agents.MessagePart>}
 */
proto.emery.agents.TaskRequest.prototype.getInputContentList = function() {
  return /** @type{!Array<!proto.emery.agents.MessagePart>} */ (
    jspb.Message.getRepeatedWrapperField(this, proto.emery.agents.MessagePart, 13));
};


/**
 * @param {!Array<!proto.emery.agents.MessagePart>} value
 * @return {!proto.emery.agents.TaskRequest} returns this
*/
proto.emery.agents.TaskRequest.prototype.setInputContentList = function(value) {
  return jspb.Message.setRepeatedWrapperField(this, 13, value);
};


/**
 * @param {!proto.emery.agents.MessagePart=} opt_value
 * @param {number=} opt_index
 * @return {!proto.emery.agents.MessagePart}
 */
proto.emery.agents.TaskRequest.prototype.addInputContent = function(opt_value, opt_index) {
  return jspb.Message.addToRepeatedWrapperField(this, 13, opt_value, proto.emery.agents.MessagePart, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.emery.agents.TaskRequest} returns this
 */
proto.emery.agents.TaskRequest.prototype.clearInputContentList = function() {
  return this.setInputContentList([]);
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.emery.agents.TaskProgress.prototype.toObject = function(opt_includeInstance) {
  return proto.emery.agents.TaskProgress.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.emery.agents.TaskProgress} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.TaskProgress.toObject = function(includeInstance, msg) {
  var f, obj = {
    taskId: jspb.Message.getFieldWithDefault(msg, 1, ""),
    status: jspb.Message.getFieldWithDefault(msg, 2, 0),
    outputJson: jspb.Message.getFieldWithDefault(msg, 5, ""),
    errorMessage: jspb.Message.getFieldWithDefault(msg, 6, ""),
    timestampMs: jspb.Message.getFieldWithDefault(msg, 7, 0),
    progressPercent: jspb.Message.getFloatingPointFieldWithDefault(msg, 8, 0.0),
    tokenUsage: (f = msg.getTokenUsage()) && proto.emery.agents.TokenUsage.toObject(includeInstance, f)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.emery.agents.TaskProgress}
 */
proto.emery.agents.TaskProgress.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.emery.agents.TaskProgress;
  return proto.emery.agents.TaskProgress.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.emery.agents.TaskProgress} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.emery.agents.TaskProgress}
 */
proto.emery.agents.TaskProgress.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setTaskId(value);
      break;
    case 2:
      var value = /** @type {!proto.emery.agents.TaskStatus} */ (reader.readEnum());
      msg.setStatus(value);
      break;
    case 5:
      var value = /** @type {string} */ (reader.readString());
      msg.setOutputJson(value);
      break;
    case 6:
      var value = /** @type {string} */ (reader.readString());
      msg.setErrorMessage(value);
      break;
    case 7:
      var value = /** @type {number} */ (reader.readInt64());
      msg.setTimestampMs(value);
      break;
    case 8:
      var value = /** @type {number} */ (reader.readFloat());
      msg.setProgressPercent(value);
      break;
    case 9:
      var value = new proto.emery.agents.TokenUsage;
      reader.readMessage(value,proto.emery.agents.TokenUsage.deserializeBinaryFromReader);
      msg.setTokenUsage(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.emery.agents.TaskProgress.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.emery.agents.TaskProgress.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.emery.agents.TaskProgress} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.TaskProgress.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getTaskId();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getStatus();
  if (f !== 0.0) {
    writer.writeEnum(
      2,
      f
    );
  }
  f = message.getOutputJson();
  if (f.length > 0) {
    writer.writeString(
      5,
      f
    );
  }
  f = message.getErrorMessage();
  if (f.length > 0) {
    writer.writeString(
      6,
      f
    );
  }
  f = message.getTimestampMs();
  if (f !== 0) {
    writer.writeInt64(
      7,
      f
    );
  }
  f = message.getProgressPercent();
  if (f !== 0.0) {
    writer.writeFloat(
      8,
      f
    );
  }
  f = message.getTokenUsage();
  if (f != null) {
    writer.writeMessage(
      9,
      f,
      proto.emery.agents.TokenUsage.serializeBinaryToWriter
    );
  }
};


/**
 * optional string task_id = 1;
 * @return {string}
 */
proto.emery.agents.TaskProgress.prototype.getTaskId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.TaskProgress} returns this
 */
proto.emery.agents.TaskProgress.prototype.setTaskId = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional TaskStatus status = 2;
 * @return {!proto.emery.agents.TaskStatus}
 */
proto.emery.agents.TaskProgress.prototype.getStatus = function() {
  return /** @type {!proto.emery.agents.TaskStatus} */ (jspb.Message.getFieldWithDefault(this, 2, 0));
};


/**
 * @param {!proto.emery.agents.TaskStatus} value
 * @return {!proto.emery.agents.TaskProgress} returns this
 */
proto.emery.agents.TaskProgress.prototype.setStatus = function(value) {
  return jspb.Message.setProto3EnumField(this, 2, value);
};


/**
 * optional string output_json = 5;
 * @return {string}
 */
proto.emery.agents.TaskProgress.prototype.getOutputJson = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 5, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.TaskProgress} returns this
 */
proto.emery.agents.TaskProgress.prototype.setOutputJson = function(value) {
  return jspb.Message.setProto3StringField(this, 5, value);
};


/**
 * optional string error_message = 6;
 * @return {string}
 */
proto.emery.agents.TaskProgress.prototype.getErrorMessage = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 6, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.TaskProgress} returns this
 */
proto.emery.agents.TaskProgress.prototype.setErrorMessage = function(value) {
  return jspb.Message.setProto3StringField(this, 6, value);
};


/**
 * optional int64 timestamp_ms = 7;
 * @return {number}
 */
proto.emery.agents.TaskProgress.prototype.getTimestampMs = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 7, 0));
};


/**
 * @param {number} value
 * @return {!proto.emery.agents.TaskProgress} returns this
 */
proto.emery.agents.TaskProgress.prototype.setTimestampMs = function(value) {
  return jspb.Message.setProto3IntField(this, 7, value);
};


/**
 * optional float progress_percent = 8;
 * @return {number}
 */
proto.emery.agents.TaskProgress.prototype.getProgressPercent = function() {
  return /** @type {number} */ (jspb.Message.getFloatingPointFieldWithDefault(this, 8, 0.0));
};


/**
 * @param {number} value
 * @return {!proto.emery.agents.TaskProgress} returns this
 */
proto.emery.agents.TaskProgress.prototype.setProgressPercent = function(value) {
  return jspb.Message.setProto3FloatField(this, 8, value);
};


/**
 * optional TokenUsage token_usage = 9;
 * @return {?proto.emery.agents.TokenUsage}
 */
proto.emery.agents.TaskProgress.prototype.getTokenUsage = function() {
  return /** @type{?proto.emery.agents.TokenUsage} */ (
    jspb.Message.getWrapperField(this, proto.emery.agents.TokenUsage, 9));
};


/**
 * @param {?proto.emery.agents.TokenUsage|undefined} value
 * @return {!proto.emery.agents.TaskProgress} returns this
*/
proto.emery.agents.TaskProgress.prototype.setTokenUsage = function(value) {
  return jspb.Message.setWrapperField(this, 9, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.emery.agents.TaskProgress} returns this
 */
proto.emery.agents.TaskProgress.prototype.clearTokenUsage = function() {
  return this.setTokenUsage(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.emery.agents.TaskProgress.prototype.hasTokenUsage = function() {
  return jspb.Message.getField(this, 9) != null;
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.emery.agents.CancelTaskRequest.prototype.toObject = function(opt_includeInstance) {
  return proto.emery.agents.CancelTaskRequest.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.emery.agents.CancelTaskRequest} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.CancelTaskRequest.toObject = function(includeInstance, msg) {
  var f, obj = {
    taskId: jspb.Message.getFieldWithDefault(msg, 1, ""),
    reason: jspb.Message.getFieldWithDefault(msg, 2, "")
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.emery.agents.CancelTaskRequest}
 */
proto.emery.agents.CancelTaskRequest.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.emery.agents.CancelTaskRequest;
  return proto.emery.agents.CancelTaskRequest.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.emery.agents.CancelTaskRequest} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.emery.agents.CancelTaskRequest}
 */
proto.emery.agents.CancelTaskRequest.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setTaskId(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setReason(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.emery.agents.CancelTaskRequest.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.emery.agents.CancelTaskRequest.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.emery.agents.CancelTaskRequest} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.CancelTaskRequest.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getTaskId();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getReason();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
};


/**
 * optional string task_id = 1;
 * @return {string}
 */
proto.emery.agents.CancelTaskRequest.prototype.getTaskId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.CancelTaskRequest} returns this
 */
proto.emery.agents.CancelTaskRequest.prototype.setTaskId = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional string reason = 2;
 * @return {string}
 */
proto.emery.agents.CancelTaskRequest.prototype.getReason = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.CancelTaskRequest} returns this
 */
proto.emery.agents.CancelTaskRequest.prototype.setReason = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.emery.agents.CancelTaskResponse.prototype.toObject = function(opt_includeInstance) {
  return proto.emery.agents.CancelTaskResponse.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.emery.agents.CancelTaskResponse} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.CancelTaskResponse.toObject = function(includeInstance, msg) {
  var f, obj = {
    success: jspb.Message.getBooleanFieldWithDefault(msg, 1, false),
    message: jspb.Message.getFieldWithDefault(msg, 2, "")
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.emery.agents.CancelTaskResponse}
 */
proto.emery.agents.CancelTaskResponse.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.emery.agents.CancelTaskResponse;
  return proto.emery.agents.CancelTaskResponse.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.emery.agents.CancelTaskResponse} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.emery.agents.CancelTaskResponse}
 */
proto.emery.agents.CancelTaskResponse.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {boolean} */ (reader.readBool());
      msg.setSuccess(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setMessage(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.emery.agents.CancelTaskResponse.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.emery.agents.CancelTaskResponse.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.emery.agents.CancelTaskResponse} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.CancelTaskResponse.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getSuccess();
  if (f) {
    writer.writeBool(
      1,
      f
    );
  }
  f = message.getMessage();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
};


/**
 * optional bool success = 1;
 * @return {boolean}
 */
proto.emery.agents.CancelTaskResponse.prototype.getSuccess = function() {
  return /** @type {boolean} */ (jspb.Message.getBooleanFieldWithDefault(this, 1, false));
};


/**
 * @param {boolean} value
 * @return {!proto.emery.agents.CancelTaskResponse} returns this
 */
proto.emery.agents.CancelTaskResponse.prototype.setSuccess = function(value) {
  return jspb.Message.setProto3BooleanField(this, 1, value);
};


/**
 * optional string message = 2;
 * @return {string}
 */
proto.emery.agents.CancelTaskResponse.prototype.getMessage = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.CancelTaskResponse} returns this
 */
proto.emery.agents.CancelTaskResponse.prototype.setMessage = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};



/**
 * List of repeated fields within this message type.
 * @private {!Array<number>}
 * @const
 */
proto.emery.agents.WorkerInfo.repeatedFields_ = [5,9];



if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.emery.agents.WorkerInfo.prototype.toObject = function(opt_includeInstance) {
  return proto.emery.agents.WorkerInfo.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.emery.agents.WorkerInfo} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.WorkerInfo.toObject = function(includeInstance, msg) {
  var f, obj = {
    workerId: jspb.Message.getFieldWithDefault(msg, 1, ""),
    version: jspb.Message.getFieldWithDefault(msg, 2, ""),
    organizationId: jspb.Message.getFieldWithDefault(msg, 3, ""),
    status: jspb.Message.getFieldWithDefault(msg, 4, 0),
    skillsList: (f = jspb.Message.getRepeatedField(msg, 5)) == null ? undefined : f,
    activeTasks: jspb.Message.getFieldWithDefault(msg, 6, 0),
    maxConcurrentTasks: jspb.Message.getFieldWithDefault(msg, 7, 0),
    uptimeSeconds: jspb.Message.getFieldWithDefault(msg, 8, 0),
    supportedToolsList: (f = jspb.Message.getRepeatedField(msg, 9)) == null ? undefined : f
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.emery.agents.WorkerInfo}
 */
proto.emery.agents.WorkerInfo.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.emery.agents.WorkerInfo;
  return proto.emery.agents.WorkerInfo.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.emery.agents.WorkerInfo} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.emery.agents.WorkerInfo}
 */
proto.emery.agents.WorkerInfo.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setWorkerId(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setVersion(value);
      break;
    case 3:
      var value = /** @type {string} */ (reader.readString());
      msg.setOrganizationId(value);
      break;
    case 4:
      var value = /** @type {!proto.emery.agents.WorkerStatus} */ (reader.readEnum());
      msg.setStatus(value);
      break;
    case 5:
      var value = /** @type {string} */ (reader.readString());
      msg.addSkills(value);
      break;
    case 6:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setActiveTasks(value);
      break;
    case 7:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setMaxConcurrentTasks(value);
      break;
    case 8:
      var value = /** @type {number} */ (reader.readInt64());
      msg.setUptimeSeconds(value);
      break;
    case 9:
      var value = /** @type {string} */ (reader.readString());
      msg.addSupportedTools(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.emery.agents.WorkerInfo.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.emery.agents.WorkerInfo.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.emery.agents.WorkerInfo} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.WorkerInfo.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getWorkerId();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getVersion();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
  f = message.getOrganizationId();
  if (f.length > 0) {
    writer.writeString(
      3,
      f
    );
  }
  f = message.getStatus();
  if (f !== 0.0) {
    writer.writeEnum(
      4,
      f
    );
  }
  f = message.getSkillsList();
  if (f.length > 0) {
    writer.writeRepeatedString(
      5,
      f
    );
  }
  f = message.getActiveTasks();
  if (f !== 0) {
    writer.writeInt32(
      6,
      f
    );
  }
  f = message.getMaxConcurrentTasks();
  if (f !== 0) {
    writer.writeInt32(
      7,
      f
    );
  }
  f = message.getUptimeSeconds();
  if (f !== 0) {
    writer.writeInt64(
      8,
      f
    );
  }
  f = message.getSupportedToolsList();
  if (f.length > 0) {
    writer.writeRepeatedString(
      9,
      f
    );
  }
};


/**
 * optional string worker_id = 1;
 * @return {string}
 */
proto.emery.agents.WorkerInfo.prototype.getWorkerId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.WorkerInfo} returns this
 */
proto.emery.agents.WorkerInfo.prototype.setWorkerId = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional string version = 2;
 * @return {string}
 */
proto.emery.agents.WorkerInfo.prototype.getVersion = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.WorkerInfo} returns this
 */
proto.emery.agents.WorkerInfo.prototype.setVersion = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};


/**
 * optional string organization_id = 3;
 * @return {string}
 */
proto.emery.agents.WorkerInfo.prototype.getOrganizationId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 3, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.WorkerInfo} returns this
 */
proto.emery.agents.WorkerInfo.prototype.setOrganizationId = function(value) {
  return jspb.Message.setProto3StringField(this, 3, value);
};


/**
 * optional WorkerStatus status = 4;
 * @return {!proto.emery.agents.WorkerStatus}
 */
proto.emery.agents.WorkerInfo.prototype.getStatus = function() {
  return /** @type {!proto.emery.agents.WorkerStatus} */ (jspb.Message.getFieldWithDefault(this, 4, 0));
};


/**
 * @param {!proto.emery.agents.WorkerStatus} value
 * @return {!proto.emery.agents.WorkerInfo} returns this
 */
proto.emery.agents.WorkerInfo.prototype.setStatus = function(value) {
  return jspb.Message.setProto3EnumField(this, 4, value);
};


/**
 * repeated string skills = 5;
 * @return {!Array<string>}
 */
proto.emery.agents.WorkerInfo.prototype.getSkillsList = function() {
  return /** @type {!Array<string>} */ (jspb.Message.getRepeatedField(this, 5));
};


/**
 * @param {!Array<string>} value
 * @return {!proto.emery.agents.WorkerInfo} returns this
 */
proto.emery.agents.WorkerInfo.prototype.setSkillsList = function(value) {
  return jspb.Message.setField(this, 5, value || []);
};


/**
 * @param {string} value
 * @param {number=} opt_index
 * @return {!proto.emery.agents.WorkerInfo} returns this
 */
proto.emery.agents.WorkerInfo.prototype.addSkills = function(value, opt_index) {
  return jspb.Message.addToRepeatedField(this, 5, value, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.emery.agents.WorkerInfo} returns this
 */
proto.emery.agents.WorkerInfo.prototype.clearSkillsList = function() {
  return this.setSkillsList([]);
};


/**
 * optional int32 active_tasks = 6;
 * @return {number}
 */
proto.emery.agents.WorkerInfo.prototype.getActiveTasks = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 6, 0));
};


/**
 * @param {number} value
 * @return {!proto.emery.agents.WorkerInfo} returns this
 */
proto.emery.agents.WorkerInfo.prototype.setActiveTasks = function(value) {
  return jspb.Message.setProto3IntField(this, 6, value);
};


/**
 * optional int32 max_concurrent_tasks = 7;
 * @return {number}
 */
proto.emery.agents.WorkerInfo.prototype.getMaxConcurrentTasks = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 7, 0));
};


/**
 * @param {number} value
 * @return {!proto.emery.agents.WorkerInfo} returns this
 */
proto.emery.agents.WorkerInfo.prototype.setMaxConcurrentTasks = function(value) {
  return jspb.Message.setProto3IntField(this, 7, value);
};


/**
 * optional int64 uptime_seconds = 8;
 * @return {number}
 */
proto.emery.agents.WorkerInfo.prototype.getUptimeSeconds = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 8, 0));
};


/**
 * @param {number} value
 * @return {!proto.emery.agents.WorkerInfo} returns this
 */
proto.emery.agents.WorkerInfo.prototype.setUptimeSeconds = function(value) {
  return jspb.Message.setProto3IntField(this, 8, value);
};


/**
 * repeated string supported_tools = 9;
 * @return {!Array<string>}
 */
proto.emery.agents.WorkerInfo.prototype.getSupportedToolsList = function() {
  return /** @type {!Array<string>} */ (jspb.Message.getRepeatedField(this, 9));
};


/**
 * @param {!Array<string>} value
 * @return {!proto.emery.agents.WorkerInfo} returns this
 */
proto.emery.agents.WorkerInfo.prototype.setSupportedToolsList = function(value) {
  return jspb.Message.setField(this, 9, value || []);
};


/**
 * @param {string} value
 * @param {number=} opt_index
 * @return {!proto.emery.agents.WorkerInfo} returns this
 */
proto.emery.agents.WorkerInfo.prototype.addSupportedTools = function(value, opt_index) {
  return jspb.Message.addToRepeatedField(this, 9, value, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.emery.agents.WorkerInfo} returns this
 */
proto.emery.agents.WorkerInfo.prototype.clearSupportedToolsList = function() {
  return this.setSupportedToolsList([]);
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.emery.agents.Empty.prototype.toObject = function(opt_includeInstance) {
  return proto.emery.agents.Empty.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.emery.agents.Empty} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.Empty.toObject = function(includeInstance, msg) {
  var f, obj = {

  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.emery.agents.Empty}
 */
proto.emery.agents.Empty.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.emery.agents.Empty;
  return proto.emery.agents.Empty.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.emery.agents.Empty} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.emery.agents.Empty}
 */
proto.emery.agents.Empty.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.emery.agents.Empty.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.emery.agents.Empty.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.emery.agents.Empty} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.Empty.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.emery.agents.ErrorResponse.prototype.toObject = function(opt_includeInstance) {
  return proto.emery.agents.ErrorResponse.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.emery.agents.ErrorResponse} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.ErrorResponse.toObject = function(includeInstance, msg) {
  var f, obj = {
    code: jspb.Message.getFieldWithDefault(msg, 1, ""),
    message: jspb.Message.getFieldWithDefault(msg, 2, ""),
    details: jspb.Message.getFieldWithDefault(msg, 3, "")
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.emery.agents.ErrorResponse}
 */
proto.emery.agents.ErrorResponse.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.emery.agents.ErrorResponse;
  return proto.emery.agents.ErrorResponse.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.emery.agents.ErrorResponse} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.emery.agents.ErrorResponse}
 */
proto.emery.agents.ErrorResponse.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setCode(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setMessage(value);
      break;
    case 3:
      var value = /** @type {string} */ (reader.readString());
      msg.setDetails(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.emery.agents.ErrorResponse.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.emery.agents.ErrorResponse.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.emery.agents.ErrorResponse} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.ErrorResponse.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getCode();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getMessage();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
  f = message.getDetails();
  if (f.length > 0) {
    writer.writeString(
      3,
      f
    );
  }
};


/**
 * optional string code = 1;
 * @return {string}
 */
proto.emery.agents.ErrorResponse.prototype.getCode = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.ErrorResponse} returns this
 */
proto.emery.agents.ErrorResponse.prototype.setCode = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional string message = 2;
 * @return {string}
 */
proto.emery.agents.ErrorResponse.prototype.getMessage = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.ErrorResponse} returns this
 */
proto.emery.agents.ErrorResponse.prototype.setMessage = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};


/**
 * optional string details = 3;
 * @return {string}
 */
proto.emery.agents.ErrorResponse.prototype.getDetails = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 3, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.ErrorResponse} returns this
 */
proto.emery.agents.ErrorResponse.prototype.setDetails = function(value) {
  return jspb.Message.setProto3StringField(this, 3, value);
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.emery.agents.TokenUsage.prototype.toObject = function(opt_includeInstance) {
  return proto.emery.agents.TokenUsage.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.emery.agents.TokenUsage} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.TokenUsage.toObject = function(includeInstance, msg) {
  var f, obj = {
    modelName: jspb.Message.getFieldWithDefault(msg, 1, ""),
    inputTokens: jspb.Message.getFieldWithDefault(msg, 2, 0),
    outputTokens: jspb.Message.getFieldWithDefault(msg, 3, 0),
    totalTokens: jspb.Message.getFieldWithDefault(msg, 4, 0),
    costUsd: jspb.Message.getFloatingPointFieldWithDefault(msg, 5, 0.0)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.emery.agents.TokenUsage}
 */
proto.emery.agents.TokenUsage.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.emery.agents.TokenUsage;
  return proto.emery.agents.TokenUsage.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.emery.agents.TokenUsage} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.emery.agents.TokenUsage}
 */
proto.emery.agents.TokenUsage.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setModelName(value);
      break;
    case 2:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setInputTokens(value);
      break;
    case 3:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setOutputTokens(value);
      break;
    case 4:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setTotalTokens(value);
      break;
    case 5:
      var value = /** @type {number} */ (reader.readDouble());
      msg.setCostUsd(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.emery.agents.TokenUsage.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.emery.agents.TokenUsage.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.emery.agents.TokenUsage} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.TokenUsage.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getModelName();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getInputTokens();
  if (f !== 0) {
    writer.writeInt32(
      2,
      f
    );
  }
  f = message.getOutputTokens();
  if (f !== 0) {
    writer.writeInt32(
      3,
      f
    );
  }
  f = message.getTotalTokens();
  if (f !== 0) {
    writer.writeInt32(
      4,
      f
    );
  }
  f = message.getCostUsd();
  if (f !== 0.0) {
    writer.writeDouble(
      5,
      f
    );
  }
};


/**
 * optional string model_name = 1;
 * @return {string}
 */
proto.emery.agents.TokenUsage.prototype.getModelName = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.TokenUsage} returns this
 */
proto.emery.agents.TokenUsage.prototype.setModelName = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional int32 input_tokens = 2;
 * @return {number}
 */
proto.emery.agents.TokenUsage.prototype.getInputTokens = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 2, 0));
};


/**
 * @param {number} value
 * @return {!proto.emery.agents.TokenUsage} returns this
 */
proto.emery.agents.TokenUsage.prototype.setInputTokens = function(value) {
  return jspb.Message.setProto3IntField(this, 2, value);
};


/**
 * optional int32 output_tokens = 3;
 * @return {number}
 */
proto.emery.agents.TokenUsage.prototype.getOutputTokens = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 3, 0));
};


/**
 * @param {number} value
 * @return {!proto.emery.agents.TokenUsage} returns this
 */
proto.emery.agents.TokenUsage.prototype.setOutputTokens = function(value) {
  return jspb.Message.setProto3IntField(this, 3, value);
};


/**
 * optional int32 total_tokens = 4;
 * @return {number}
 */
proto.emery.agents.TokenUsage.prototype.getTotalTokens = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 4, 0));
};


/**
 * @param {number} value
 * @return {!proto.emery.agents.TokenUsage} returns this
 */
proto.emery.agents.TokenUsage.prototype.setTotalTokens = function(value) {
  return jspb.Message.setProto3IntField(this, 4, value);
};


/**
 * optional double cost_usd = 5;
 * @return {number}
 */
proto.emery.agents.TokenUsage.prototype.getCostUsd = function() {
  return /** @type {number} */ (jspb.Message.getFloatingPointFieldWithDefault(this, 5, 0.0));
};


/**
 * @param {number} value
 * @return {!proto.emery.agents.TokenUsage} returns this
 */
proto.emery.agents.TokenUsage.prototype.setCostUsd = function(value) {
  return jspb.Message.setProto3FloatField(this, 5, value);
};



/**
 * List of repeated fields within this message type.
 * @private {!Array<number>}
 * @const
 */
proto.emery.agents.AgentConfig.repeatedFields_ = [5,6,7];



if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.emery.agents.AgentConfig.prototype.toObject = function(opt_includeInstance) {
  return proto.emery.agents.AgentConfig.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.emery.agents.AgentConfig} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.AgentConfig.toObject = function(includeInstance, msg) {
  var f, obj = {
    name: jspb.Message.getFieldWithDefault(msg, 1, ""),
    role: jspb.Message.getFieldWithDefault(msg, 2, ""),
    description: jspb.Message.getFieldWithDefault(msg, 3, ""),
    persona: jspb.Message.getFieldWithDefault(msg, 4, ""),
    toolsList: jspb.Message.toObjectList(msg.getToolsList(),
    proto.emery.agents.ToolConfig.toObject, includeInstance),
    serversList: jspb.Message.toObjectList(msg.getServersList(),
    proto.emery.agents.ServerConfig.toObject, includeInstance),
    skillsList: jspb.Message.toObjectList(msg.getSkillsList(),
    proto.emery.agents.SkillConfig.toObject, includeInstance),
    defaultModel: jspb.Message.getFieldWithDefault(msg, 8, "")
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.emery.agents.AgentConfig}
 */
proto.emery.agents.AgentConfig.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.emery.agents.AgentConfig;
  return proto.emery.agents.AgentConfig.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.emery.agents.AgentConfig} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.emery.agents.AgentConfig}
 */
proto.emery.agents.AgentConfig.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setName(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setRole(value);
      break;
    case 3:
      var value = /** @type {string} */ (reader.readString());
      msg.setDescription(value);
      break;
    case 4:
      var value = /** @type {string} */ (reader.readString());
      msg.setPersona(value);
      break;
    case 5:
      var value = new proto.emery.agents.ToolConfig;
      reader.readMessage(value,proto.emery.agents.ToolConfig.deserializeBinaryFromReader);
      msg.addTools(value);
      break;
    case 6:
      var value = new proto.emery.agents.ServerConfig;
      reader.readMessage(value,proto.emery.agents.ServerConfig.deserializeBinaryFromReader);
      msg.addServers(value);
      break;
    case 7:
      var value = new proto.emery.agents.SkillConfig;
      reader.readMessage(value,proto.emery.agents.SkillConfig.deserializeBinaryFromReader);
      msg.addSkills(value);
      break;
    case 8:
      var value = /** @type {string} */ (reader.readString());
      msg.setDefaultModel(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.emery.agents.AgentConfig.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.emery.agents.AgentConfig.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.emery.agents.AgentConfig} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.AgentConfig.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getName();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getRole();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
  f = message.getDescription();
  if (f.length > 0) {
    writer.writeString(
      3,
      f
    );
  }
  f = message.getPersona();
  if (f.length > 0) {
    writer.writeString(
      4,
      f
    );
  }
  f = message.getToolsList();
  if (f.length > 0) {
    writer.writeRepeatedMessage(
      5,
      f,
      proto.emery.agents.ToolConfig.serializeBinaryToWriter
    );
  }
  f = message.getServersList();
  if (f.length > 0) {
    writer.writeRepeatedMessage(
      6,
      f,
      proto.emery.agents.ServerConfig.serializeBinaryToWriter
    );
  }
  f = message.getSkillsList();
  if (f.length > 0) {
    writer.writeRepeatedMessage(
      7,
      f,
      proto.emery.agents.SkillConfig.serializeBinaryToWriter
    );
  }
  f = message.getDefaultModel();
  if (f.length > 0) {
    writer.writeString(
      8,
      f
    );
  }
};


/**
 * optional string name = 1;
 * @return {string}
 */
proto.emery.agents.AgentConfig.prototype.getName = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.AgentConfig} returns this
 */
proto.emery.agents.AgentConfig.prototype.setName = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional string role = 2;
 * @return {string}
 */
proto.emery.agents.AgentConfig.prototype.getRole = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.AgentConfig} returns this
 */
proto.emery.agents.AgentConfig.prototype.setRole = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};


/**
 * optional string description = 3;
 * @return {string}
 */
proto.emery.agents.AgentConfig.prototype.getDescription = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 3, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.AgentConfig} returns this
 */
proto.emery.agents.AgentConfig.prototype.setDescription = function(value) {
  return jspb.Message.setProto3StringField(this, 3, value);
};


/**
 * optional string persona = 4;
 * @return {string}
 */
proto.emery.agents.AgentConfig.prototype.getPersona = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 4, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.AgentConfig} returns this
 */
proto.emery.agents.AgentConfig.prototype.setPersona = function(value) {
  return jspb.Message.setProto3StringField(this, 4, value);
};


/**
 * repeated ToolConfig tools = 5;
 * @return {!Array<!proto.emery.agents.ToolConfig>}
 */
proto.emery.agents.AgentConfig.prototype.getToolsList = function() {
  return /** @type{!Array<!proto.emery.agents.ToolConfig>} */ (
    jspb.Message.getRepeatedWrapperField(this, proto.emery.agents.ToolConfig, 5));
};


/**
 * @param {!Array<!proto.emery.agents.ToolConfig>} value
 * @return {!proto.emery.agents.AgentConfig} returns this
*/
proto.emery.agents.AgentConfig.prototype.setToolsList = function(value) {
  return jspb.Message.setRepeatedWrapperField(this, 5, value);
};


/**
 * @param {!proto.emery.agents.ToolConfig=} opt_value
 * @param {number=} opt_index
 * @return {!proto.emery.agents.ToolConfig}
 */
proto.emery.agents.AgentConfig.prototype.addTools = function(opt_value, opt_index) {
  return jspb.Message.addToRepeatedWrapperField(this, 5, opt_value, proto.emery.agents.ToolConfig, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.emery.agents.AgentConfig} returns this
 */
proto.emery.agents.AgentConfig.prototype.clearToolsList = function() {
  return this.setToolsList([]);
};


/**
 * repeated ServerConfig servers = 6;
 * @return {!Array<!proto.emery.agents.ServerConfig>}
 */
proto.emery.agents.AgentConfig.prototype.getServersList = function() {
  return /** @type{!Array<!proto.emery.agents.ServerConfig>} */ (
    jspb.Message.getRepeatedWrapperField(this, proto.emery.agents.ServerConfig, 6));
};


/**
 * @param {!Array<!proto.emery.agents.ServerConfig>} value
 * @return {!proto.emery.agents.AgentConfig} returns this
*/
proto.emery.agents.AgentConfig.prototype.setServersList = function(value) {
  return jspb.Message.setRepeatedWrapperField(this, 6, value);
};


/**
 * @param {!proto.emery.agents.ServerConfig=} opt_value
 * @param {number=} opt_index
 * @return {!proto.emery.agents.ServerConfig}
 */
proto.emery.agents.AgentConfig.prototype.addServers = function(opt_value, opt_index) {
  return jspb.Message.addToRepeatedWrapperField(this, 6, opt_value, proto.emery.agents.ServerConfig, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.emery.agents.AgentConfig} returns this
 */
proto.emery.agents.AgentConfig.prototype.clearServersList = function() {
  return this.setServersList([]);
};


/**
 * repeated SkillConfig skills = 7;
 * @return {!Array<!proto.emery.agents.SkillConfig>}
 */
proto.emery.agents.AgentConfig.prototype.getSkillsList = function() {
  return /** @type{!Array<!proto.emery.agents.SkillConfig>} */ (
    jspb.Message.getRepeatedWrapperField(this, proto.emery.agents.SkillConfig, 7));
};


/**
 * @param {!Array<!proto.emery.agents.SkillConfig>} value
 * @return {!proto.emery.agents.AgentConfig} returns this
*/
proto.emery.agents.AgentConfig.prototype.setSkillsList = function(value) {
  return jspb.Message.setRepeatedWrapperField(this, 7, value);
};


/**
 * @param {!proto.emery.agents.SkillConfig=} opt_value
 * @param {number=} opt_index
 * @return {!proto.emery.agents.SkillConfig}
 */
proto.emery.agents.AgentConfig.prototype.addSkills = function(opt_value, opt_index) {
  return jspb.Message.addToRepeatedWrapperField(this, 7, opt_value, proto.emery.agents.SkillConfig, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.emery.agents.AgentConfig} returns this
 */
proto.emery.agents.AgentConfig.prototype.clearSkillsList = function() {
  return this.setSkillsList([]);
};


/**
 * optional string default_model = 8;
 * @return {string}
 */
proto.emery.agents.AgentConfig.prototype.getDefaultModel = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 8, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.AgentConfig} returns this
 */
proto.emery.agents.AgentConfig.prototype.setDefaultModel = function(value) {
  return jspb.Message.setProto3StringField(this, 8, value);
};



/**
 * List of repeated fields within this message type.
 * @private {!Array<number>}
 * @const
 */
proto.emery.agents.SkillConfig.repeatedFields_ = [4,5,7,9,20];



if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.emery.agents.SkillConfig.prototype.toObject = function(opt_includeInstance) {
  return proto.emery.agents.SkillConfig.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.emery.agents.SkillConfig} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.SkillConfig.toObject = function(includeInstance, msg) {
  var f, obj = {
    id: jspb.Message.getFieldWithDefault(msg, 1, 0),
    name: jspb.Message.getFieldWithDefault(msg, 2, ""),
    description: jspb.Message.getFieldWithDefault(msg, 3, ""),
    inputsList: jspb.Message.toObjectList(msg.getInputsList(),
    proto.emery.agents.InputDefinition.toObject, includeInstance),
    outputsList: jspb.Message.toObjectList(msg.getOutputsList(),
    proto.emery.agents.OutputDefinition.toObject, includeInstance),
    instructions: jspb.Message.getFieldWithDefault(msg, 6, ""),
    toolsList: jspb.Message.toObjectList(msg.getToolsList(),
    proto.emery.agents.ToolConfig.toObject, includeInstance),
    model: jspb.Message.getFieldWithDefault(msg, 8, ""),
    contentList: jspb.Message.toObjectList(msg.getContentList(),
    proto.emery.agents.MessagePart.toObject, includeInstance),
    agentType: jspb.Message.getFieldWithDefault(msg, 10, ""),
    executionType: jspb.Message.getFieldWithDefault(msg, 11, ""),
    taskModelConfig: (f = msg.getTaskModelConfig()) && proto.emery.agents.TaskModelConfig.toObject(includeInstance, f),
    toolExecutionConfig: (f = msg.getToolExecutionConfig()) && proto.emery.agents.ToolExecutionConfig.toObject(includeInstance, f),
    writeConfig: (f = msg.getWriteConfig()) && proto.emery.agents.WriteConfig.toObject(includeInstance, f),
    readConfig: (f = msg.getReadConfig()) && proto.emery.agents.ReadConfig.toObject(includeInstance, f),
    stepsList: jspb.Message.toObjectList(msg.getStepsList(),
    proto.emery.agents.SkillStep.toObject, includeInstance)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.emery.agents.SkillConfig}
 */
proto.emery.agents.SkillConfig.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.emery.agents.SkillConfig;
  return proto.emery.agents.SkillConfig.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.emery.agents.SkillConfig} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.emery.agents.SkillConfig}
 */
proto.emery.agents.SkillConfig.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setId(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setName(value);
      break;
    case 3:
      var value = /** @type {string} */ (reader.readString());
      msg.setDescription(value);
      break;
    case 4:
      var value = new proto.emery.agents.InputDefinition;
      reader.readMessage(value,proto.emery.agents.InputDefinition.deserializeBinaryFromReader);
      msg.addInputs(value);
      break;
    case 5:
      var value = new proto.emery.agents.OutputDefinition;
      reader.readMessage(value,proto.emery.agents.OutputDefinition.deserializeBinaryFromReader);
      msg.addOutputs(value);
      break;
    case 6:
      var value = /** @type {string} */ (reader.readString());
      msg.setInstructions(value);
      break;
    case 7:
      var value = new proto.emery.agents.ToolConfig;
      reader.readMessage(value,proto.emery.agents.ToolConfig.deserializeBinaryFromReader);
      msg.addTools(value);
      break;
    case 8:
      var value = /** @type {string} */ (reader.readString());
      msg.setModel(value);
      break;
    case 9:
      var value = new proto.emery.agents.MessagePart;
      reader.readMessage(value,proto.emery.agents.MessagePart.deserializeBinaryFromReader);
      msg.addContent(value);
      break;
    case 10:
      var value = /** @type {string} */ (reader.readString());
      msg.setAgentType(value);
      break;
    case 11:
      var value = /** @type {string} */ (reader.readString());
      msg.setExecutionType(value);
      break;
    case 12:
      var value = new proto.emery.agents.TaskModelConfig;
      reader.readMessage(value,proto.emery.agents.TaskModelConfig.deserializeBinaryFromReader);
      msg.setTaskModelConfig(value);
      break;
    case 13:
      var value = new proto.emery.agents.ToolExecutionConfig;
      reader.readMessage(value,proto.emery.agents.ToolExecutionConfig.deserializeBinaryFromReader);
      msg.setToolExecutionConfig(value);
      break;
    case 14:
      var value = new proto.emery.agents.WriteConfig;
      reader.readMessage(value,proto.emery.agents.WriteConfig.deserializeBinaryFromReader);
      msg.setWriteConfig(value);
      break;
    case 15:
      var value = new proto.emery.agents.ReadConfig;
      reader.readMessage(value,proto.emery.agents.ReadConfig.deserializeBinaryFromReader);
      msg.setReadConfig(value);
      break;
    case 20:
      var value = new proto.emery.agents.SkillStep;
      reader.readMessage(value,proto.emery.agents.SkillStep.deserializeBinaryFromReader);
      msg.addSteps(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.emery.agents.SkillConfig.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.emery.agents.SkillConfig.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.emery.agents.SkillConfig} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.SkillConfig.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getId();
  if (f !== 0) {
    writer.writeInt32(
      1,
      f
    );
  }
  f = message.getName();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
  f = message.getDescription();
  if (f.length > 0) {
    writer.writeString(
      3,
      f
    );
  }
  f = message.getInputsList();
  if (f.length > 0) {
    writer.writeRepeatedMessage(
      4,
      f,
      proto.emery.agents.InputDefinition.serializeBinaryToWriter
    );
  }
  f = message.getOutputsList();
  if (f.length > 0) {
    writer.writeRepeatedMessage(
      5,
      f,
      proto.emery.agents.OutputDefinition.serializeBinaryToWriter
    );
  }
  f = message.getInstructions();
  if (f.length > 0) {
    writer.writeString(
      6,
      f
    );
  }
  f = message.getToolsList();
  if (f.length > 0) {
    writer.writeRepeatedMessage(
      7,
      f,
      proto.emery.agents.ToolConfig.serializeBinaryToWriter
    );
  }
  f = message.getModel();
  if (f.length > 0) {
    writer.writeString(
      8,
      f
    );
  }
  f = message.getContentList();
  if (f.length > 0) {
    writer.writeRepeatedMessage(
      9,
      f,
      proto.emery.agents.MessagePart.serializeBinaryToWriter
    );
  }
  f = message.getAgentType();
  if (f.length > 0) {
    writer.writeString(
      10,
      f
    );
  }
  f = message.getExecutionType();
  if (f.length > 0) {
    writer.writeString(
      11,
      f
    );
  }
  f = message.getTaskModelConfig();
  if (f != null) {
    writer.writeMessage(
      12,
      f,
      proto.emery.agents.TaskModelConfig.serializeBinaryToWriter
    );
  }
  f = message.getToolExecutionConfig();
  if (f != null) {
    writer.writeMessage(
      13,
      f,
      proto.emery.agents.ToolExecutionConfig.serializeBinaryToWriter
    );
  }
  f = message.getWriteConfig();
  if (f != null) {
    writer.writeMessage(
      14,
      f,
      proto.emery.agents.WriteConfig.serializeBinaryToWriter
    );
  }
  f = message.getReadConfig();
  if (f != null) {
    writer.writeMessage(
      15,
      f,
      proto.emery.agents.ReadConfig.serializeBinaryToWriter
    );
  }
  f = message.getStepsList();
  if (f.length > 0) {
    writer.writeRepeatedMessage(
      20,
      f,
      proto.emery.agents.SkillStep.serializeBinaryToWriter
    );
  }
};


/**
 * optional int32 id = 1;
 * @return {number}
 */
proto.emery.agents.SkillConfig.prototype.getId = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 1, 0));
};


/**
 * @param {number} value
 * @return {!proto.emery.agents.SkillConfig} returns this
 */
proto.emery.agents.SkillConfig.prototype.setId = function(value) {
  return jspb.Message.setProto3IntField(this, 1, value);
};


/**
 * optional string name = 2;
 * @return {string}
 */
proto.emery.agents.SkillConfig.prototype.getName = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.SkillConfig} returns this
 */
proto.emery.agents.SkillConfig.prototype.setName = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};


/**
 * optional string description = 3;
 * @return {string}
 */
proto.emery.agents.SkillConfig.prototype.getDescription = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 3, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.SkillConfig} returns this
 */
proto.emery.agents.SkillConfig.prototype.setDescription = function(value) {
  return jspb.Message.setProto3StringField(this, 3, value);
};


/**
 * repeated InputDefinition inputs = 4;
 * @return {!Array<!proto.emery.agents.InputDefinition>}
 */
proto.emery.agents.SkillConfig.prototype.getInputsList = function() {
  return /** @type{!Array<!proto.emery.agents.InputDefinition>} */ (
    jspb.Message.getRepeatedWrapperField(this, proto.emery.agents.InputDefinition, 4));
};


/**
 * @param {!Array<!proto.emery.agents.InputDefinition>} value
 * @return {!proto.emery.agents.SkillConfig} returns this
*/
proto.emery.agents.SkillConfig.prototype.setInputsList = function(value) {
  return jspb.Message.setRepeatedWrapperField(this, 4, value);
};


/**
 * @param {!proto.emery.agents.InputDefinition=} opt_value
 * @param {number=} opt_index
 * @return {!proto.emery.agents.InputDefinition}
 */
proto.emery.agents.SkillConfig.prototype.addInputs = function(opt_value, opt_index) {
  return jspb.Message.addToRepeatedWrapperField(this, 4, opt_value, proto.emery.agents.InputDefinition, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.emery.agents.SkillConfig} returns this
 */
proto.emery.agents.SkillConfig.prototype.clearInputsList = function() {
  return this.setInputsList([]);
};


/**
 * repeated OutputDefinition outputs = 5;
 * @return {!Array<!proto.emery.agents.OutputDefinition>}
 */
proto.emery.agents.SkillConfig.prototype.getOutputsList = function() {
  return /** @type{!Array<!proto.emery.agents.OutputDefinition>} */ (
    jspb.Message.getRepeatedWrapperField(this, proto.emery.agents.OutputDefinition, 5));
};


/**
 * @param {!Array<!proto.emery.agents.OutputDefinition>} value
 * @return {!proto.emery.agents.SkillConfig} returns this
*/
proto.emery.agents.SkillConfig.prototype.setOutputsList = function(value) {
  return jspb.Message.setRepeatedWrapperField(this, 5, value);
};


/**
 * @param {!proto.emery.agents.OutputDefinition=} opt_value
 * @param {number=} opt_index
 * @return {!proto.emery.agents.OutputDefinition}
 */
proto.emery.agents.SkillConfig.prototype.addOutputs = function(opt_value, opt_index) {
  return jspb.Message.addToRepeatedWrapperField(this, 5, opt_value, proto.emery.agents.OutputDefinition, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.emery.agents.SkillConfig} returns this
 */
proto.emery.agents.SkillConfig.prototype.clearOutputsList = function() {
  return this.setOutputsList([]);
};


/**
 * optional string instructions = 6;
 * @return {string}
 */
proto.emery.agents.SkillConfig.prototype.getInstructions = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 6, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.SkillConfig} returns this
 */
proto.emery.agents.SkillConfig.prototype.setInstructions = function(value) {
  return jspb.Message.setProto3StringField(this, 6, value);
};


/**
 * repeated ToolConfig tools = 7;
 * @return {!Array<!proto.emery.agents.ToolConfig>}
 */
proto.emery.agents.SkillConfig.prototype.getToolsList = function() {
  return /** @type{!Array<!proto.emery.agents.ToolConfig>} */ (
    jspb.Message.getRepeatedWrapperField(this, proto.emery.agents.ToolConfig, 7));
};


/**
 * @param {!Array<!proto.emery.agents.ToolConfig>} value
 * @return {!proto.emery.agents.SkillConfig} returns this
*/
proto.emery.agents.SkillConfig.prototype.setToolsList = function(value) {
  return jspb.Message.setRepeatedWrapperField(this, 7, value);
};


/**
 * @param {!proto.emery.agents.ToolConfig=} opt_value
 * @param {number=} opt_index
 * @return {!proto.emery.agents.ToolConfig}
 */
proto.emery.agents.SkillConfig.prototype.addTools = function(opt_value, opt_index) {
  return jspb.Message.addToRepeatedWrapperField(this, 7, opt_value, proto.emery.agents.ToolConfig, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.emery.agents.SkillConfig} returns this
 */
proto.emery.agents.SkillConfig.prototype.clearToolsList = function() {
  return this.setToolsList([]);
};


/**
 * optional string model = 8;
 * @return {string}
 */
proto.emery.agents.SkillConfig.prototype.getModel = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 8, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.SkillConfig} returns this
 */
proto.emery.agents.SkillConfig.prototype.setModel = function(value) {
  return jspb.Message.setProto3StringField(this, 8, value);
};


/**
 * repeated MessagePart content = 9;
 * @return {!Array<!proto.emery.agents.MessagePart>}
 */
proto.emery.agents.SkillConfig.prototype.getContentList = function() {
  return /** @type{!Array<!proto.emery.agents.MessagePart>} */ (
    jspb.Message.getRepeatedWrapperField(this, proto.emery.agents.MessagePart, 9));
};


/**
 * @param {!Array<!proto.emery.agents.MessagePart>} value
 * @return {!proto.emery.agents.SkillConfig} returns this
*/
proto.emery.agents.SkillConfig.prototype.setContentList = function(value) {
  return jspb.Message.setRepeatedWrapperField(this, 9, value);
};


/**
 * @param {!proto.emery.agents.MessagePart=} opt_value
 * @param {number=} opt_index
 * @return {!proto.emery.agents.MessagePart}
 */
proto.emery.agents.SkillConfig.prototype.addContent = function(opt_value, opt_index) {
  return jspb.Message.addToRepeatedWrapperField(this, 9, opt_value, proto.emery.agents.MessagePart, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.emery.agents.SkillConfig} returns this
 */
proto.emery.agents.SkillConfig.prototype.clearContentList = function() {
  return this.setContentList([]);
};


/**
 * optional string agent_type = 10;
 * @return {string}
 */
proto.emery.agents.SkillConfig.prototype.getAgentType = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 10, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.SkillConfig} returns this
 */
proto.emery.agents.SkillConfig.prototype.setAgentType = function(value) {
  return jspb.Message.setProto3StringField(this, 10, value);
};


/**
 * optional string execution_type = 11;
 * @return {string}
 */
proto.emery.agents.SkillConfig.prototype.getExecutionType = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 11, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.SkillConfig} returns this
 */
proto.emery.agents.SkillConfig.prototype.setExecutionType = function(value) {
  return jspb.Message.setProto3StringField(this, 11, value);
};


/**
 * optional TaskModelConfig task_model_config = 12;
 * @return {?proto.emery.agents.TaskModelConfig}
 */
proto.emery.agents.SkillConfig.prototype.getTaskModelConfig = function() {
  return /** @type{?proto.emery.agents.TaskModelConfig} */ (
    jspb.Message.getWrapperField(this, proto.emery.agents.TaskModelConfig, 12));
};


/**
 * @param {?proto.emery.agents.TaskModelConfig|undefined} value
 * @return {!proto.emery.agents.SkillConfig} returns this
*/
proto.emery.agents.SkillConfig.prototype.setTaskModelConfig = function(value) {
  return jspb.Message.setWrapperField(this, 12, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.emery.agents.SkillConfig} returns this
 */
proto.emery.agents.SkillConfig.prototype.clearTaskModelConfig = function() {
  return this.setTaskModelConfig(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.emery.agents.SkillConfig.prototype.hasTaskModelConfig = function() {
  return jspb.Message.getField(this, 12) != null;
};


/**
 * optional ToolExecutionConfig tool_execution_config = 13;
 * @return {?proto.emery.agents.ToolExecutionConfig}
 */
proto.emery.agents.SkillConfig.prototype.getToolExecutionConfig = function() {
  return /** @type{?proto.emery.agents.ToolExecutionConfig} */ (
    jspb.Message.getWrapperField(this, proto.emery.agents.ToolExecutionConfig, 13));
};


/**
 * @param {?proto.emery.agents.ToolExecutionConfig|undefined} value
 * @return {!proto.emery.agents.SkillConfig} returns this
*/
proto.emery.agents.SkillConfig.prototype.setToolExecutionConfig = function(value) {
  return jspb.Message.setWrapperField(this, 13, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.emery.agents.SkillConfig} returns this
 */
proto.emery.agents.SkillConfig.prototype.clearToolExecutionConfig = function() {
  return this.setToolExecutionConfig(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.emery.agents.SkillConfig.prototype.hasToolExecutionConfig = function() {
  return jspb.Message.getField(this, 13) != null;
};


/**
 * optional WriteConfig write_config = 14;
 * @return {?proto.emery.agents.WriteConfig}
 */
proto.emery.agents.SkillConfig.prototype.getWriteConfig = function() {
  return /** @type{?proto.emery.agents.WriteConfig} */ (
    jspb.Message.getWrapperField(this, proto.emery.agents.WriteConfig, 14));
};


/**
 * @param {?proto.emery.agents.WriteConfig|undefined} value
 * @return {!proto.emery.agents.SkillConfig} returns this
*/
proto.emery.agents.SkillConfig.prototype.setWriteConfig = function(value) {
  return jspb.Message.setWrapperField(this, 14, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.emery.agents.SkillConfig} returns this
 */
proto.emery.agents.SkillConfig.prototype.clearWriteConfig = function() {
  return this.setWriteConfig(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.emery.agents.SkillConfig.prototype.hasWriteConfig = function() {
  return jspb.Message.getField(this, 14) != null;
};


/**
 * optional ReadConfig read_config = 15;
 * @return {?proto.emery.agents.ReadConfig}
 */
proto.emery.agents.SkillConfig.prototype.getReadConfig = function() {
  return /** @type{?proto.emery.agents.ReadConfig} */ (
    jspb.Message.getWrapperField(this, proto.emery.agents.ReadConfig, 15));
};


/**
 * @param {?proto.emery.agents.ReadConfig|undefined} value
 * @return {!proto.emery.agents.SkillConfig} returns this
*/
proto.emery.agents.SkillConfig.prototype.setReadConfig = function(value) {
  return jspb.Message.setWrapperField(this, 15, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.emery.agents.SkillConfig} returns this
 */
proto.emery.agents.SkillConfig.prototype.clearReadConfig = function() {
  return this.setReadConfig(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.emery.agents.SkillConfig.prototype.hasReadConfig = function() {
  return jspb.Message.getField(this, 15) != null;
};


/**
 * repeated SkillStep steps = 20;
 * @return {!Array<!proto.emery.agents.SkillStep>}
 */
proto.emery.agents.SkillConfig.prototype.getStepsList = function() {
  return /** @type{!Array<!proto.emery.agents.SkillStep>} */ (
    jspb.Message.getRepeatedWrapperField(this, proto.emery.agents.SkillStep, 20));
};


/**
 * @param {!Array<!proto.emery.agents.SkillStep>} value
 * @return {!proto.emery.agents.SkillConfig} returns this
*/
proto.emery.agents.SkillConfig.prototype.setStepsList = function(value) {
  return jspb.Message.setRepeatedWrapperField(this, 20, value);
};


/**
 * @param {!proto.emery.agents.SkillStep=} opt_value
 * @param {number=} opt_index
 * @return {!proto.emery.agents.SkillStep}
 */
proto.emery.agents.SkillConfig.prototype.addSteps = function(opt_value, opt_index) {
  return jspb.Message.addToRepeatedWrapperField(this, 20, opt_value, proto.emery.agents.SkillStep, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.emery.agents.SkillConfig} returns this
 */
proto.emery.agents.SkillConfig.prototype.clearStepsList = function() {
  return this.setStepsList([]);
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.emery.agents.InputFieldSource.prototype.toObject = function(opt_includeInstance) {
  return proto.emery.agents.InputFieldSource.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.emery.agents.InputFieldSource} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.InputFieldSource.toObject = function(includeInstance, msg) {
  var f, obj = {
    tableId: jspb.Message.getFieldWithDefault(msg, 1, 0),
    fieldId: jspb.Message.getFieldWithDefault(msg, 2, 0),
    rowSource: (f = msg.getRowSource()) && proto.emery.agents.RowIdSource.toObject(includeInstance, f)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.emery.agents.InputFieldSource}
 */
proto.emery.agents.InputFieldSource.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.emery.agents.InputFieldSource;
  return proto.emery.agents.InputFieldSource.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.emery.agents.InputFieldSource} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.emery.agents.InputFieldSource}
 */
proto.emery.agents.InputFieldSource.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setTableId(value);
      break;
    case 2:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setFieldId(value);
      break;
    case 3:
      var value = new proto.emery.agents.RowIdSource;
      reader.readMessage(value,proto.emery.agents.RowIdSource.deserializeBinaryFromReader);
      msg.setRowSource(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.emery.agents.InputFieldSource.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.emery.agents.InputFieldSource.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.emery.agents.InputFieldSource} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.InputFieldSource.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getTableId();
  if (f !== 0) {
    writer.writeInt32(
      1,
      f
    );
  }
  f = message.getFieldId();
  if (f !== 0) {
    writer.writeInt32(
      2,
      f
    );
  }
  f = message.getRowSource();
  if (f != null) {
    writer.writeMessage(
      3,
      f,
      proto.emery.agents.RowIdSource.serializeBinaryToWriter
    );
  }
};


/**
 * optional int32 table_id = 1;
 * @return {number}
 */
proto.emery.agents.InputFieldSource.prototype.getTableId = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 1, 0));
};


/**
 * @param {number} value
 * @return {!proto.emery.agents.InputFieldSource} returns this
 */
proto.emery.agents.InputFieldSource.prototype.setTableId = function(value) {
  return jspb.Message.setProto3IntField(this, 1, value);
};


/**
 * optional int32 field_id = 2;
 * @return {number}
 */
proto.emery.agents.InputFieldSource.prototype.getFieldId = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 2, 0));
};


/**
 * @param {number} value
 * @return {!proto.emery.agents.InputFieldSource} returns this
 */
proto.emery.agents.InputFieldSource.prototype.setFieldId = function(value) {
  return jspb.Message.setProto3IntField(this, 2, value);
};


/**
 * optional RowIdSource row_source = 3;
 * @return {?proto.emery.agents.RowIdSource}
 */
proto.emery.agents.InputFieldSource.prototype.getRowSource = function() {
  return /** @type{?proto.emery.agents.RowIdSource} */ (
    jspb.Message.getWrapperField(this, proto.emery.agents.RowIdSource, 3));
};


/**
 * @param {?proto.emery.agents.RowIdSource|undefined} value
 * @return {!proto.emery.agents.InputFieldSource} returns this
*/
proto.emery.agents.InputFieldSource.prototype.setRowSource = function(value) {
  return jspb.Message.setWrapperField(this, 3, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.emery.agents.InputFieldSource} returns this
 */
proto.emery.agents.InputFieldSource.prototype.clearRowSource = function() {
  return this.setRowSource(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.emery.agents.InputFieldSource.prototype.hasRowSource = function() {
  return jspb.Message.getField(this, 3) != null;
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.emery.agents.InputMappingConfig.prototype.toObject = function(opt_includeInstance) {
  return proto.emery.agents.InputMappingConfig.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.emery.agents.InputMappingConfig} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.InputMappingConfig.toObject = function(includeInstance, msg) {
  var f, obj = {
    source: (f = msg.getSource()) && proto.emery.agents.InputFieldSource.toObject(includeInstance, f)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.emery.agents.InputMappingConfig}
 */
proto.emery.agents.InputMappingConfig.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.emery.agents.InputMappingConfig;
  return proto.emery.agents.InputMappingConfig.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.emery.agents.InputMappingConfig} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.emery.agents.InputMappingConfig}
 */
proto.emery.agents.InputMappingConfig.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = new proto.emery.agents.InputFieldSource;
      reader.readMessage(value,proto.emery.agents.InputFieldSource.deserializeBinaryFromReader);
      msg.setSource(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.emery.agents.InputMappingConfig.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.emery.agents.InputMappingConfig.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.emery.agents.InputMappingConfig} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.InputMappingConfig.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getSource();
  if (f != null) {
    writer.writeMessage(
      1,
      f,
      proto.emery.agents.InputFieldSource.serializeBinaryToWriter
    );
  }
};


/**
 * optional InputFieldSource source = 1;
 * @return {?proto.emery.agents.InputFieldSource}
 */
proto.emery.agents.InputMappingConfig.prototype.getSource = function() {
  return /** @type{?proto.emery.agents.InputFieldSource} */ (
    jspb.Message.getWrapperField(this, proto.emery.agents.InputFieldSource, 1));
};


/**
 * @param {?proto.emery.agents.InputFieldSource|undefined} value
 * @return {!proto.emery.agents.InputMappingConfig} returns this
*/
proto.emery.agents.InputMappingConfig.prototype.setSource = function(value) {
  return jspb.Message.setWrapperField(this, 1, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.emery.agents.InputMappingConfig} returns this
 */
proto.emery.agents.InputMappingConfig.prototype.clearSource = function() {
  return this.setSource(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.emery.agents.InputMappingConfig.prototype.hasSource = function() {
  return jspb.Message.getField(this, 1) != null;
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.emery.agents.InputDefinition.prototype.toObject = function(opt_includeInstance) {
  return proto.emery.agents.InputDefinition.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.emery.agents.InputDefinition} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.InputDefinition.toObject = function(includeInstance, msg) {
  var f, obj = {
    name: jspb.Message.getFieldWithDefault(msg, 1, ""),
    required: jspb.Message.getBooleanFieldWithDefault(msg, 2, false),
    type: jspb.Message.getFieldWithDefault(msg, 3, ""),
    inputMapping: (f = msg.getInputMapping()) && proto.emery.agents.InputMappingConfig.toObject(includeInstance, f)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.emery.agents.InputDefinition}
 */
proto.emery.agents.InputDefinition.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.emery.agents.InputDefinition;
  return proto.emery.agents.InputDefinition.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.emery.agents.InputDefinition} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.emery.agents.InputDefinition}
 */
proto.emery.agents.InputDefinition.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setName(value);
      break;
    case 2:
      var value = /** @type {boolean} */ (reader.readBool());
      msg.setRequired(value);
      break;
    case 3:
      var value = /** @type {string} */ (reader.readString());
      msg.setType(value);
      break;
    case 4:
      var value = new proto.emery.agents.InputMappingConfig;
      reader.readMessage(value,proto.emery.agents.InputMappingConfig.deserializeBinaryFromReader);
      msg.setInputMapping(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.emery.agents.InputDefinition.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.emery.agents.InputDefinition.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.emery.agents.InputDefinition} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.InputDefinition.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getName();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getRequired();
  if (f) {
    writer.writeBool(
      2,
      f
    );
  }
  f = message.getType();
  if (f.length > 0) {
    writer.writeString(
      3,
      f
    );
  }
  f = message.getInputMapping();
  if (f != null) {
    writer.writeMessage(
      4,
      f,
      proto.emery.agents.InputMappingConfig.serializeBinaryToWriter
    );
  }
};


/**
 * optional string name = 1;
 * @return {string}
 */
proto.emery.agents.InputDefinition.prototype.getName = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.InputDefinition} returns this
 */
proto.emery.agents.InputDefinition.prototype.setName = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional bool required = 2;
 * @return {boolean}
 */
proto.emery.agents.InputDefinition.prototype.getRequired = function() {
  return /** @type {boolean} */ (jspb.Message.getBooleanFieldWithDefault(this, 2, false));
};


/**
 * @param {boolean} value
 * @return {!proto.emery.agents.InputDefinition} returns this
 */
proto.emery.agents.InputDefinition.prototype.setRequired = function(value) {
  return jspb.Message.setProto3BooleanField(this, 2, value);
};


/**
 * optional string type = 3;
 * @return {string}
 */
proto.emery.agents.InputDefinition.prototype.getType = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 3, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.InputDefinition} returns this
 */
proto.emery.agents.InputDefinition.prototype.setType = function(value) {
  return jspb.Message.setProto3StringField(this, 3, value);
};


/**
 * optional InputMappingConfig input_mapping = 4;
 * @return {?proto.emery.agents.InputMappingConfig}
 */
proto.emery.agents.InputDefinition.prototype.getInputMapping = function() {
  return /** @type{?proto.emery.agents.InputMappingConfig} */ (
    jspb.Message.getWrapperField(this, proto.emery.agents.InputMappingConfig, 4));
};


/**
 * @param {?proto.emery.agents.InputMappingConfig|undefined} value
 * @return {!proto.emery.agents.InputDefinition} returns this
*/
proto.emery.agents.InputDefinition.prototype.setInputMapping = function(value) {
  return jspb.Message.setWrapperField(this, 4, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.emery.agents.InputDefinition} returns this
 */
proto.emery.agents.InputDefinition.prototype.clearInputMapping = function() {
  return this.setInputMapping(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.emery.agents.InputDefinition.prototype.hasInputMapping = function() {
  return jspb.Message.getField(this, 4) != null;
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.emery.agents.OutputSource.prototype.toObject = function(opt_includeInstance) {
  return proto.emery.agents.OutputSource.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.emery.agents.OutputSource} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.OutputSource.toObject = function(includeInstance, msg) {
  var f, obj = {
    type: jspb.Message.getFieldWithDefault(msg, 1, ""),
    nodeId: jspb.Message.getFieldWithDefault(msg, 2, ""),
    outputName: jspb.Message.getFieldWithDefault(msg, 3, "")
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.emery.agents.OutputSource}
 */
proto.emery.agents.OutputSource.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.emery.agents.OutputSource;
  return proto.emery.agents.OutputSource.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.emery.agents.OutputSource} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.emery.agents.OutputSource}
 */
proto.emery.agents.OutputSource.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setType(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setNodeId(value);
      break;
    case 3:
      var value = /** @type {string} */ (reader.readString());
      msg.setOutputName(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.emery.agents.OutputSource.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.emery.agents.OutputSource.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.emery.agents.OutputSource} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.OutputSource.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getType();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getNodeId();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
  f = message.getOutputName();
  if (f.length > 0) {
    writer.writeString(
      3,
      f
    );
  }
};


/**
 * optional string type = 1;
 * @return {string}
 */
proto.emery.agents.OutputSource.prototype.getType = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.OutputSource} returns this
 */
proto.emery.agents.OutputSource.prototype.setType = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional string node_id = 2;
 * @return {string}
 */
proto.emery.agents.OutputSource.prototype.getNodeId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.OutputSource} returns this
 */
proto.emery.agents.OutputSource.prototype.setNodeId = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};


/**
 * optional string output_name = 3;
 * @return {string}
 */
proto.emery.agents.OutputSource.prototype.getOutputName = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 3, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.OutputSource} returns this
 */
proto.emery.agents.OutputSource.prototype.setOutputName = function(value) {
  return jspb.Message.setProto3StringField(this, 3, value);
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.emery.agents.OutputDefinition.prototype.toObject = function(opt_includeInstance) {
  return proto.emery.agents.OutputDefinition.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.emery.agents.OutputDefinition} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.OutputDefinition.toObject = function(includeInstance, msg) {
  var f, obj = {
    name: jspb.Message.getFieldWithDefault(msg, 1, ""),
    type: jspb.Message.getFieldWithDefault(msg, 2, ""),
    outputMapping: (f = msg.getOutputMapping()) && proto.emery.agents.OutputMappingConfig.toObject(includeInstance, f),
    description: jspb.Message.getFieldWithDefault(msg, 4, ""),
    source: (f = msg.getSource()) && proto.emery.agents.OutputSource.toObject(includeInstance, f)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.emery.agents.OutputDefinition}
 */
proto.emery.agents.OutputDefinition.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.emery.agents.OutputDefinition;
  return proto.emery.agents.OutputDefinition.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.emery.agents.OutputDefinition} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.emery.agents.OutputDefinition}
 */
proto.emery.agents.OutputDefinition.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setName(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setType(value);
      break;
    case 3:
      var value = new proto.emery.agents.OutputMappingConfig;
      reader.readMessage(value,proto.emery.agents.OutputMappingConfig.deserializeBinaryFromReader);
      msg.setOutputMapping(value);
      break;
    case 4:
      var value = /** @type {string} */ (reader.readString());
      msg.setDescription(value);
      break;
    case 5:
      var value = new proto.emery.agents.OutputSource;
      reader.readMessage(value,proto.emery.agents.OutputSource.deserializeBinaryFromReader);
      msg.setSource(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.emery.agents.OutputDefinition.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.emery.agents.OutputDefinition.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.emery.agents.OutputDefinition} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.OutputDefinition.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getName();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getType();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
  f = message.getOutputMapping();
  if (f != null) {
    writer.writeMessage(
      3,
      f,
      proto.emery.agents.OutputMappingConfig.serializeBinaryToWriter
    );
  }
  f = message.getDescription();
  if (f.length > 0) {
    writer.writeString(
      4,
      f
    );
  }
  f = message.getSource();
  if (f != null) {
    writer.writeMessage(
      5,
      f,
      proto.emery.agents.OutputSource.serializeBinaryToWriter
    );
  }
};


/**
 * optional string name = 1;
 * @return {string}
 */
proto.emery.agents.OutputDefinition.prototype.getName = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.OutputDefinition} returns this
 */
proto.emery.agents.OutputDefinition.prototype.setName = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional string type = 2;
 * @return {string}
 */
proto.emery.agents.OutputDefinition.prototype.getType = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.OutputDefinition} returns this
 */
proto.emery.agents.OutputDefinition.prototype.setType = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};


/**
 * optional OutputMappingConfig output_mapping = 3;
 * @return {?proto.emery.agents.OutputMappingConfig}
 */
proto.emery.agents.OutputDefinition.prototype.getOutputMapping = function() {
  return /** @type{?proto.emery.agents.OutputMappingConfig} */ (
    jspb.Message.getWrapperField(this, proto.emery.agents.OutputMappingConfig, 3));
};


/**
 * @param {?proto.emery.agents.OutputMappingConfig|undefined} value
 * @return {!proto.emery.agents.OutputDefinition} returns this
*/
proto.emery.agents.OutputDefinition.prototype.setOutputMapping = function(value) {
  return jspb.Message.setWrapperField(this, 3, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.emery.agents.OutputDefinition} returns this
 */
proto.emery.agents.OutputDefinition.prototype.clearOutputMapping = function() {
  return this.setOutputMapping(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.emery.agents.OutputDefinition.prototype.hasOutputMapping = function() {
  return jspb.Message.getField(this, 3) != null;
};


/**
 * optional string description = 4;
 * @return {string}
 */
proto.emery.agents.OutputDefinition.prototype.getDescription = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 4, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.OutputDefinition} returns this
 */
proto.emery.agents.OutputDefinition.prototype.setDescription = function(value) {
  return jspb.Message.setProto3StringField(this, 4, value);
};


/**
 * optional OutputSource source = 5;
 * @return {?proto.emery.agents.OutputSource}
 */
proto.emery.agents.OutputDefinition.prototype.getSource = function() {
  return /** @type{?proto.emery.agents.OutputSource} */ (
    jspb.Message.getWrapperField(this, proto.emery.agents.OutputSource, 5));
};


/**
 * @param {?proto.emery.agents.OutputSource|undefined} value
 * @return {!proto.emery.agents.OutputDefinition} returns this
*/
proto.emery.agents.OutputDefinition.prototype.setSource = function(value) {
  return jspb.Message.setWrapperField(this, 5, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.emery.agents.OutputDefinition} returns this
 */
proto.emery.agents.OutputDefinition.prototype.clearSource = function() {
  return this.setSource(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.emery.agents.OutputDefinition.prototype.hasSource = function() {
  return jspb.Message.getField(this, 5) != null;
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.emery.agents.ErrorConfig.prototype.toObject = function(opt_includeInstance) {
  return proto.emery.agents.ErrorConfig.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.emery.agents.ErrorConfig} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.ErrorConfig.toObject = function(includeInstance, msg) {
  var f, obj = {
    continueOnError: jspb.Message.getBooleanFieldWithDefault(msg, 1, false),
    errorOutputVar: jspb.Message.getFieldWithDefault(msg, 2, "")
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.emery.agents.ErrorConfig}
 */
proto.emery.agents.ErrorConfig.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.emery.agents.ErrorConfig;
  return proto.emery.agents.ErrorConfig.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.emery.agents.ErrorConfig} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.emery.agents.ErrorConfig}
 */
proto.emery.agents.ErrorConfig.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {boolean} */ (reader.readBool());
      msg.setContinueOnError(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setErrorOutputVar(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.emery.agents.ErrorConfig.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.emery.agents.ErrorConfig.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.emery.agents.ErrorConfig} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.ErrorConfig.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getContinueOnError();
  if (f) {
    writer.writeBool(
      1,
      f
    );
  }
  f = message.getErrorOutputVar();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
};


/**
 * optional bool continue_on_error = 1;
 * @return {boolean}
 */
proto.emery.agents.ErrorConfig.prototype.getContinueOnError = function() {
  return /** @type {boolean} */ (jspb.Message.getBooleanFieldWithDefault(this, 1, false));
};


/**
 * @param {boolean} value
 * @return {!proto.emery.agents.ErrorConfig} returns this
 */
proto.emery.agents.ErrorConfig.prototype.setContinueOnError = function(value) {
  return jspb.Message.setProto3BooleanField(this, 1, value);
};


/**
 * optional string error_output_var = 2;
 * @return {string}
 */
proto.emery.agents.ErrorConfig.prototype.getErrorOutputVar = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.ErrorConfig} returns this
 */
proto.emery.agents.ErrorConfig.prototype.setErrorOutputVar = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.emery.agents.RetryConfig.prototype.toObject = function(opt_includeInstance) {
  return proto.emery.agents.RetryConfig.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.emery.agents.RetryConfig} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.RetryConfig.toObject = function(includeInstance, msg) {
  var f, obj = {
    maxAttempts: jspb.Message.getFieldWithDefault(msg, 1, 0),
    backoffMs: jspb.Message.getFieldWithDefault(msg, 2, 0),
    backoffType: jspb.Message.getFieldWithDefault(msg, 3, "")
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.emery.agents.RetryConfig}
 */
proto.emery.agents.RetryConfig.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.emery.agents.RetryConfig;
  return proto.emery.agents.RetryConfig.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.emery.agents.RetryConfig} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.emery.agents.RetryConfig}
 */
proto.emery.agents.RetryConfig.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setMaxAttempts(value);
      break;
    case 2:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setBackoffMs(value);
      break;
    case 3:
      var value = /** @type {string} */ (reader.readString());
      msg.setBackoffType(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.emery.agents.RetryConfig.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.emery.agents.RetryConfig.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.emery.agents.RetryConfig} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.RetryConfig.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getMaxAttempts();
  if (f !== 0) {
    writer.writeInt32(
      1,
      f
    );
  }
  f = message.getBackoffMs();
  if (f !== 0) {
    writer.writeInt32(
      2,
      f
    );
  }
  f = message.getBackoffType();
  if (f.length > 0) {
    writer.writeString(
      3,
      f
    );
  }
};


/**
 * optional int32 max_attempts = 1;
 * @return {number}
 */
proto.emery.agents.RetryConfig.prototype.getMaxAttempts = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 1, 0));
};


/**
 * @param {number} value
 * @return {!proto.emery.agents.RetryConfig} returns this
 */
proto.emery.agents.RetryConfig.prototype.setMaxAttempts = function(value) {
  return jspb.Message.setProto3IntField(this, 1, value);
};


/**
 * optional int32 backoff_ms = 2;
 * @return {number}
 */
proto.emery.agents.RetryConfig.prototype.getBackoffMs = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 2, 0));
};


/**
 * @param {number} value
 * @return {!proto.emery.agents.RetryConfig} returns this
 */
proto.emery.agents.RetryConfig.prototype.setBackoffMs = function(value) {
  return jspb.Message.setProto3IntField(this, 2, value);
};


/**
 * optional string backoff_type = 3;
 * @return {string}
 */
proto.emery.agents.RetryConfig.prototype.getBackoffType = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 3, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.RetryConfig} returns this
 */
proto.emery.agents.RetryConfig.prototype.setBackoffType = function(value) {
  return jspb.Message.setProto3StringField(this, 3, value);
};



/**
 * List of repeated fields within this message type.
 * @private {!Array<number>}
 * @const
 */
proto.emery.agents.StepOutput.repeatedFields_ = [3];



if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.emery.agents.StepOutput.prototype.toObject = function(opt_includeInstance) {
  return proto.emery.agents.StepOutput.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.emery.agents.StepOutput} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.StepOutput.toObject = function(includeInstance, msg) {
  var f, obj = {
    type: jspb.Message.getFieldWithDefault(msg, 1, ""),
    condition: jspb.Message.getFieldWithDefault(msg, 2, ""),
    nextStepsList: (f = jspb.Message.getRepeatedField(msg, 3)) == null ? undefined : f
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.emery.agents.StepOutput}
 */
proto.emery.agents.StepOutput.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.emery.agents.StepOutput;
  return proto.emery.agents.StepOutput.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.emery.agents.StepOutput} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.emery.agents.StepOutput}
 */
proto.emery.agents.StepOutput.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setType(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setCondition(value);
      break;
    case 3:
      var value = /** @type {string} */ (reader.readString());
      msg.addNextSteps(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.emery.agents.StepOutput.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.emery.agents.StepOutput.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.emery.agents.StepOutput} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.StepOutput.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getType();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getCondition();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
  f = message.getNextStepsList();
  if (f.length > 0) {
    writer.writeRepeatedString(
      3,
      f
    );
  }
};


/**
 * optional string type = 1;
 * @return {string}
 */
proto.emery.agents.StepOutput.prototype.getType = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.StepOutput} returns this
 */
proto.emery.agents.StepOutput.prototype.setType = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional string condition = 2;
 * @return {string}
 */
proto.emery.agents.StepOutput.prototype.getCondition = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.StepOutput} returns this
 */
proto.emery.agents.StepOutput.prototype.setCondition = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};


/**
 * repeated string next_steps = 3;
 * @return {!Array<string>}
 */
proto.emery.agents.StepOutput.prototype.getNextStepsList = function() {
  return /** @type {!Array<string>} */ (jspb.Message.getRepeatedField(this, 3));
};


/**
 * @param {!Array<string>} value
 * @return {!proto.emery.agents.StepOutput} returns this
 */
proto.emery.agents.StepOutput.prototype.setNextStepsList = function(value) {
  return jspb.Message.setField(this, 3, value || []);
};


/**
 * @param {string} value
 * @param {number=} opt_index
 * @return {!proto.emery.agents.StepOutput} returns this
 */
proto.emery.agents.StepOutput.prototype.addNextSteps = function(value, opt_index) {
  return jspb.Message.addToRepeatedField(this, 3, value, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.emery.agents.StepOutput} returns this
 */
proto.emery.agents.StepOutput.prototype.clearNextStepsList = function() {
  return this.setNextStepsList([]);
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.emery.agents.LoopConfig.prototype.toObject = function(opt_includeInstance) {
  return proto.emery.agents.LoopConfig.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.emery.agents.LoopConfig} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.LoopConfig.toObject = function(includeInstance, msg) {
  var f, obj = {
    type: jspb.Message.getFieldWithDefault(msg, 1, ""),
    itemsVar: jspb.Message.getFieldWithDefault(msg, 2, ""),
    currentItemVar: jspb.Message.getFieldWithDefault(msg, 3, ""),
    condition: jspb.Message.getFieldWithDefault(msg, 4, ""),
    maxIterations: jspb.Message.getFieldWithDefault(msg, 5, 0)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.emery.agents.LoopConfig}
 */
proto.emery.agents.LoopConfig.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.emery.agents.LoopConfig;
  return proto.emery.agents.LoopConfig.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.emery.agents.LoopConfig} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.emery.agents.LoopConfig}
 */
proto.emery.agents.LoopConfig.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setType(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setItemsVar(value);
      break;
    case 3:
      var value = /** @type {string} */ (reader.readString());
      msg.setCurrentItemVar(value);
      break;
    case 4:
      var value = /** @type {string} */ (reader.readString());
      msg.setCondition(value);
      break;
    case 5:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setMaxIterations(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.emery.agents.LoopConfig.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.emery.agents.LoopConfig.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.emery.agents.LoopConfig} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.LoopConfig.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getType();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getItemsVar();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
  f = message.getCurrentItemVar();
  if (f.length > 0) {
    writer.writeString(
      3,
      f
    );
  }
  f = message.getCondition();
  if (f.length > 0) {
    writer.writeString(
      4,
      f
    );
  }
  f = message.getMaxIterations();
  if (f !== 0) {
    writer.writeInt32(
      5,
      f
    );
  }
};


/**
 * optional string type = 1;
 * @return {string}
 */
proto.emery.agents.LoopConfig.prototype.getType = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.LoopConfig} returns this
 */
proto.emery.agents.LoopConfig.prototype.setType = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional string items_var = 2;
 * @return {string}
 */
proto.emery.agents.LoopConfig.prototype.getItemsVar = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.LoopConfig} returns this
 */
proto.emery.agents.LoopConfig.prototype.setItemsVar = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};


/**
 * optional string current_item_var = 3;
 * @return {string}
 */
proto.emery.agents.LoopConfig.prototype.getCurrentItemVar = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 3, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.LoopConfig} returns this
 */
proto.emery.agents.LoopConfig.prototype.setCurrentItemVar = function(value) {
  return jspb.Message.setProto3StringField(this, 3, value);
};


/**
 * optional string condition = 4;
 * @return {string}
 */
proto.emery.agents.LoopConfig.prototype.getCondition = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 4, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.LoopConfig} returns this
 */
proto.emery.agents.LoopConfig.prototype.setCondition = function(value) {
  return jspb.Message.setProto3StringField(this, 4, value);
};


/**
 * optional int32 max_iterations = 5;
 * @return {number}
 */
proto.emery.agents.LoopConfig.prototype.getMaxIterations = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 5, 0));
};


/**
 * @param {number} value
 * @return {!proto.emery.agents.LoopConfig} returns this
 */
proto.emery.agents.LoopConfig.prototype.setMaxIterations = function(value) {
  return jspb.Message.setProto3IntField(this, 5, value);
};



/**
 * List of repeated fields within this message type.
 * @private {!Array<number>}
 * @const
 */
proto.emery.agents.SkillStep.repeatedFields_ = [4,9,10,13];



if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.emery.agents.SkillStep.prototype.toObject = function(opt_includeInstance) {
  return proto.emery.agents.SkillStep.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.emery.agents.SkillStep} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.SkillStep.toObject = function(includeInstance, msg) {
  var f, obj = {
    id: jspb.Message.getFieldWithDefault(msg, 20, ""),
    name: jspb.Message.getFieldWithDefault(msg, 1, ""),
    instruction: jspb.Message.getFieldWithDefault(msg, 2, ""),
    skillId: jspb.Message.getFieldWithDefault(msg, 3, 0),
    toolsList: (f = jspb.Message.getRepeatedField(msg, 4)) == null ? undefined : f,
    inputsMap: (f = msg.getInputsMap()) ? f.toObject(includeInstance, undefined) : [],
    outputsMap: (f = msg.getOutputsMap()) ? f.toObject(includeInstance, undefined) : [],
    parallel: jspb.Message.getBooleanFieldWithDefault(msg, 7, false),
    condition: jspb.Message.getFieldWithDefault(msg, 8, ""),
    inputDefsList: jspb.Message.toObjectList(msg.getInputDefsList(),
    proto.emery.agents.InputDefinition.toObject, includeInstance),
    outputDefsList: jspb.Message.toObjectList(msg.getOutputDefsList(),
    proto.emery.agents.OutputDefinition.toObject, includeInstance),
    errorConfig: (f = msg.getErrorConfig()) && proto.emery.agents.ErrorConfig.toObject(includeInstance, f),
    retryConfig: (f = msg.getRetryConfig()) && proto.emery.agents.RetryConfig.toObject(includeInstance, f),
    stepOutputsList: jspb.Message.toObjectList(msg.getStepOutputsList(),
    proto.emery.agents.StepOutput.toObject, includeInstance),
    parallelGroup: jspb.Message.getFieldWithDefault(msg, 14, ""),
    loopConfig: (f = msg.getLoopConfig()) && proto.emery.agents.LoopConfig.toObject(includeInstance, f),
    readConfig: (f = msg.getReadConfig()) && proto.emery.agents.ReadConfig.toObject(includeInstance, f),
    writeConfig: (f = msg.getWriteConfig()) && proto.emery.agents.WriteConfig.toObject(includeInstance, f),
    toolExecutionConfig: (f = msg.getToolExecutionConfig()) && proto.emery.agents.ToolExecutionConfig.toObject(includeInstance, f),
    taskModelConfig: (f = msg.getTaskModelConfig()) && proto.emery.agents.TaskModelConfig.toObject(includeInstance, f)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.emery.agents.SkillStep}
 */
proto.emery.agents.SkillStep.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.emery.agents.SkillStep;
  return proto.emery.agents.SkillStep.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.emery.agents.SkillStep} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.emery.agents.SkillStep}
 */
proto.emery.agents.SkillStep.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 20:
      var value = /** @type {string} */ (reader.readString());
      msg.setId(value);
      break;
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setName(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setInstruction(value);
      break;
    case 3:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setSkillId(value);
      break;
    case 4:
      var value = /** @type {string} */ (reader.readString());
      msg.addTools(value);
      break;
    case 5:
      var value = msg.getInputsMap();
      reader.readMessage(value, function(message, reader) {
        jspb.Map.deserializeBinary(message, reader, jspb.BinaryReader.prototype.readString, jspb.BinaryReader.prototype.readString, null, "", "");
         });
      break;
    case 6:
      var value = msg.getOutputsMap();
      reader.readMessage(value, function(message, reader) {
        jspb.Map.deserializeBinary(message, reader, jspb.BinaryReader.prototype.readString, jspb.BinaryReader.prototype.readString, null, "", "");
         });
      break;
    case 7:
      var value = /** @type {boolean} */ (reader.readBool());
      msg.setParallel(value);
      break;
    case 8:
      var value = /** @type {string} */ (reader.readString());
      msg.setCondition(value);
      break;
    case 9:
      var value = new proto.emery.agents.InputDefinition;
      reader.readMessage(value,proto.emery.agents.InputDefinition.deserializeBinaryFromReader);
      msg.addInputDefs(value);
      break;
    case 10:
      var value = new proto.emery.agents.OutputDefinition;
      reader.readMessage(value,proto.emery.agents.OutputDefinition.deserializeBinaryFromReader);
      msg.addOutputDefs(value);
      break;
    case 11:
      var value = new proto.emery.agents.ErrorConfig;
      reader.readMessage(value,proto.emery.agents.ErrorConfig.deserializeBinaryFromReader);
      msg.setErrorConfig(value);
      break;
    case 12:
      var value = new proto.emery.agents.RetryConfig;
      reader.readMessage(value,proto.emery.agents.RetryConfig.deserializeBinaryFromReader);
      msg.setRetryConfig(value);
      break;
    case 13:
      var value = new proto.emery.agents.StepOutput;
      reader.readMessage(value,proto.emery.agents.StepOutput.deserializeBinaryFromReader);
      msg.addStepOutputs(value);
      break;
    case 14:
      var value = /** @type {string} */ (reader.readString());
      msg.setParallelGroup(value);
      break;
    case 15:
      var value = new proto.emery.agents.LoopConfig;
      reader.readMessage(value,proto.emery.agents.LoopConfig.deserializeBinaryFromReader);
      msg.setLoopConfig(value);
      break;
    case 16:
      var value = new proto.emery.agents.ReadConfig;
      reader.readMessage(value,proto.emery.agents.ReadConfig.deserializeBinaryFromReader);
      msg.setReadConfig(value);
      break;
    case 17:
      var value = new proto.emery.agents.WriteConfig;
      reader.readMessage(value,proto.emery.agents.WriteConfig.deserializeBinaryFromReader);
      msg.setWriteConfig(value);
      break;
    case 18:
      var value = new proto.emery.agents.ToolExecutionConfig;
      reader.readMessage(value,proto.emery.agents.ToolExecutionConfig.deserializeBinaryFromReader);
      msg.setToolExecutionConfig(value);
      break;
    case 19:
      var value = new proto.emery.agents.TaskModelConfig;
      reader.readMessage(value,proto.emery.agents.TaskModelConfig.deserializeBinaryFromReader);
      msg.setTaskModelConfig(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.emery.agents.SkillStep.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.emery.agents.SkillStep.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.emery.agents.SkillStep} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.SkillStep.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getId();
  if (f.length > 0) {
    writer.writeString(
      20,
      f
    );
  }
  f = message.getName();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getInstruction();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
  f = message.getSkillId();
  if (f !== 0) {
    writer.writeInt32(
      3,
      f
    );
  }
  f = message.getToolsList();
  if (f.length > 0) {
    writer.writeRepeatedString(
      4,
      f
    );
  }
  f = message.getInputsMap(true);
  if (f && f.getLength() > 0) {
    f.serializeBinary(5, writer, jspb.BinaryWriter.prototype.writeString, jspb.BinaryWriter.prototype.writeString);
  }
  f = message.getOutputsMap(true);
  if (f && f.getLength() > 0) {
    f.serializeBinary(6, writer, jspb.BinaryWriter.prototype.writeString, jspb.BinaryWriter.prototype.writeString);
  }
  f = message.getParallel();
  if (f) {
    writer.writeBool(
      7,
      f
    );
  }
  f = message.getCondition();
  if (f.length > 0) {
    writer.writeString(
      8,
      f
    );
  }
  f = message.getInputDefsList();
  if (f.length > 0) {
    writer.writeRepeatedMessage(
      9,
      f,
      proto.emery.agents.InputDefinition.serializeBinaryToWriter
    );
  }
  f = message.getOutputDefsList();
  if (f.length > 0) {
    writer.writeRepeatedMessage(
      10,
      f,
      proto.emery.agents.OutputDefinition.serializeBinaryToWriter
    );
  }
  f = message.getErrorConfig();
  if (f != null) {
    writer.writeMessage(
      11,
      f,
      proto.emery.agents.ErrorConfig.serializeBinaryToWriter
    );
  }
  f = message.getRetryConfig();
  if (f != null) {
    writer.writeMessage(
      12,
      f,
      proto.emery.agents.RetryConfig.serializeBinaryToWriter
    );
  }
  f = message.getStepOutputsList();
  if (f.length > 0) {
    writer.writeRepeatedMessage(
      13,
      f,
      proto.emery.agents.StepOutput.serializeBinaryToWriter
    );
  }
  f = message.getParallelGroup();
  if (f.length > 0) {
    writer.writeString(
      14,
      f
    );
  }
  f = message.getLoopConfig();
  if (f != null) {
    writer.writeMessage(
      15,
      f,
      proto.emery.agents.LoopConfig.serializeBinaryToWriter
    );
  }
  f = message.getReadConfig();
  if (f != null) {
    writer.writeMessage(
      16,
      f,
      proto.emery.agents.ReadConfig.serializeBinaryToWriter
    );
  }
  f = message.getWriteConfig();
  if (f != null) {
    writer.writeMessage(
      17,
      f,
      proto.emery.agents.WriteConfig.serializeBinaryToWriter
    );
  }
  f = message.getToolExecutionConfig();
  if (f != null) {
    writer.writeMessage(
      18,
      f,
      proto.emery.agents.ToolExecutionConfig.serializeBinaryToWriter
    );
  }
  f = message.getTaskModelConfig();
  if (f != null) {
    writer.writeMessage(
      19,
      f,
      proto.emery.agents.TaskModelConfig.serializeBinaryToWriter
    );
  }
};


/**
 * optional string id = 20;
 * @return {string}
 */
proto.emery.agents.SkillStep.prototype.getId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 20, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.SkillStep} returns this
 */
proto.emery.agents.SkillStep.prototype.setId = function(value) {
  return jspb.Message.setProto3StringField(this, 20, value);
};


/**
 * optional string name = 1;
 * @return {string}
 */
proto.emery.agents.SkillStep.prototype.getName = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.SkillStep} returns this
 */
proto.emery.agents.SkillStep.prototype.setName = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional string instruction = 2;
 * @return {string}
 */
proto.emery.agents.SkillStep.prototype.getInstruction = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.SkillStep} returns this
 */
proto.emery.agents.SkillStep.prototype.setInstruction = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};


/**
 * optional int32 skill_id = 3;
 * @return {number}
 */
proto.emery.agents.SkillStep.prototype.getSkillId = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 3, 0));
};


/**
 * @param {number} value
 * @return {!proto.emery.agents.SkillStep} returns this
 */
proto.emery.agents.SkillStep.prototype.setSkillId = function(value) {
  return jspb.Message.setProto3IntField(this, 3, value);
};


/**
 * repeated string tools = 4;
 * @return {!Array<string>}
 */
proto.emery.agents.SkillStep.prototype.getToolsList = function() {
  return /** @type {!Array<string>} */ (jspb.Message.getRepeatedField(this, 4));
};


/**
 * @param {!Array<string>} value
 * @return {!proto.emery.agents.SkillStep} returns this
 */
proto.emery.agents.SkillStep.prototype.setToolsList = function(value) {
  return jspb.Message.setField(this, 4, value || []);
};


/**
 * @param {string} value
 * @param {number=} opt_index
 * @return {!proto.emery.agents.SkillStep} returns this
 */
proto.emery.agents.SkillStep.prototype.addTools = function(value, opt_index) {
  return jspb.Message.addToRepeatedField(this, 4, value, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.emery.agents.SkillStep} returns this
 */
proto.emery.agents.SkillStep.prototype.clearToolsList = function() {
  return this.setToolsList([]);
};


/**
 * map<string, string> inputs = 5;
 * @param {boolean=} opt_noLazyCreate Do not create the map if
 * empty, instead returning `undefined`
 * @return {!jspb.Map<string,string>}
 */
proto.emery.agents.SkillStep.prototype.getInputsMap = function(opt_noLazyCreate) {
  return /** @type {!jspb.Map<string,string>} */ (
      jspb.Message.getMapField(this, 5, opt_noLazyCreate,
      null));
};


/**
 * Clears values from the map. The map will be non-null.
 * @return {!proto.emery.agents.SkillStep} returns this
 */
proto.emery.agents.SkillStep.prototype.clearInputsMap = function() {
  this.getInputsMap().clear();
  return this;};


/**
 * map<string, string> outputs = 6;
 * @param {boolean=} opt_noLazyCreate Do not create the map if
 * empty, instead returning `undefined`
 * @return {!jspb.Map<string,string>}
 */
proto.emery.agents.SkillStep.prototype.getOutputsMap = function(opt_noLazyCreate) {
  return /** @type {!jspb.Map<string,string>} */ (
      jspb.Message.getMapField(this, 6, opt_noLazyCreate,
      null));
};


/**
 * Clears values from the map. The map will be non-null.
 * @return {!proto.emery.agents.SkillStep} returns this
 */
proto.emery.agents.SkillStep.prototype.clearOutputsMap = function() {
  this.getOutputsMap().clear();
  return this;};


/**
 * optional bool parallel = 7;
 * @return {boolean}
 */
proto.emery.agents.SkillStep.prototype.getParallel = function() {
  return /** @type {boolean} */ (jspb.Message.getBooleanFieldWithDefault(this, 7, false));
};


/**
 * @param {boolean} value
 * @return {!proto.emery.agents.SkillStep} returns this
 */
proto.emery.agents.SkillStep.prototype.setParallel = function(value) {
  return jspb.Message.setProto3BooleanField(this, 7, value);
};


/**
 * optional string condition = 8;
 * @return {string}
 */
proto.emery.agents.SkillStep.prototype.getCondition = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 8, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.SkillStep} returns this
 */
proto.emery.agents.SkillStep.prototype.setCondition = function(value) {
  return jspb.Message.setProto3StringField(this, 8, value);
};


/**
 * repeated InputDefinition input_defs = 9;
 * @return {!Array<!proto.emery.agents.InputDefinition>}
 */
proto.emery.agents.SkillStep.prototype.getInputDefsList = function() {
  return /** @type{!Array<!proto.emery.agents.InputDefinition>} */ (
    jspb.Message.getRepeatedWrapperField(this, proto.emery.agents.InputDefinition, 9));
};


/**
 * @param {!Array<!proto.emery.agents.InputDefinition>} value
 * @return {!proto.emery.agents.SkillStep} returns this
*/
proto.emery.agents.SkillStep.prototype.setInputDefsList = function(value) {
  return jspb.Message.setRepeatedWrapperField(this, 9, value);
};


/**
 * @param {!proto.emery.agents.InputDefinition=} opt_value
 * @param {number=} opt_index
 * @return {!proto.emery.agents.InputDefinition}
 */
proto.emery.agents.SkillStep.prototype.addInputDefs = function(opt_value, opt_index) {
  return jspb.Message.addToRepeatedWrapperField(this, 9, opt_value, proto.emery.agents.InputDefinition, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.emery.agents.SkillStep} returns this
 */
proto.emery.agents.SkillStep.prototype.clearInputDefsList = function() {
  return this.setInputDefsList([]);
};


/**
 * repeated OutputDefinition output_defs = 10;
 * @return {!Array<!proto.emery.agents.OutputDefinition>}
 */
proto.emery.agents.SkillStep.prototype.getOutputDefsList = function() {
  return /** @type{!Array<!proto.emery.agents.OutputDefinition>} */ (
    jspb.Message.getRepeatedWrapperField(this, proto.emery.agents.OutputDefinition, 10));
};


/**
 * @param {!Array<!proto.emery.agents.OutputDefinition>} value
 * @return {!proto.emery.agents.SkillStep} returns this
*/
proto.emery.agents.SkillStep.prototype.setOutputDefsList = function(value) {
  return jspb.Message.setRepeatedWrapperField(this, 10, value);
};


/**
 * @param {!proto.emery.agents.OutputDefinition=} opt_value
 * @param {number=} opt_index
 * @return {!proto.emery.agents.OutputDefinition}
 */
proto.emery.agents.SkillStep.prototype.addOutputDefs = function(opt_value, opt_index) {
  return jspb.Message.addToRepeatedWrapperField(this, 10, opt_value, proto.emery.agents.OutputDefinition, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.emery.agents.SkillStep} returns this
 */
proto.emery.agents.SkillStep.prototype.clearOutputDefsList = function() {
  return this.setOutputDefsList([]);
};


/**
 * optional ErrorConfig error_config = 11;
 * @return {?proto.emery.agents.ErrorConfig}
 */
proto.emery.agents.SkillStep.prototype.getErrorConfig = function() {
  return /** @type{?proto.emery.agents.ErrorConfig} */ (
    jspb.Message.getWrapperField(this, proto.emery.agents.ErrorConfig, 11));
};


/**
 * @param {?proto.emery.agents.ErrorConfig|undefined} value
 * @return {!proto.emery.agents.SkillStep} returns this
*/
proto.emery.agents.SkillStep.prototype.setErrorConfig = function(value) {
  return jspb.Message.setWrapperField(this, 11, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.emery.agents.SkillStep} returns this
 */
proto.emery.agents.SkillStep.prototype.clearErrorConfig = function() {
  return this.setErrorConfig(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.emery.agents.SkillStep.prototype.hasErrorConfig = function() {
  return jspb.Message.getField(this, 11) != null;
};


/**
 * optional RetryConfig retry_config = 12;
 * @return {?proto.emery.agents.RetryConfig}
 */
proto.emery.agents.SkillStep.prototype.getRetryConfig = function() {
  return /** @type{?proto.emery.agents.RetryConfig} */ (
    jspb.Message.getWrapperField(this, proto.emery.agents.RetryConfig, 12));
};


/**
 * @param {?proto.emery.agents.RetryConfig|undefined} value
 * @return {!proto.emery.agents.SkillStep} returns this
*/
proto.emery.agents.SkillStep.prototype.setRetryConfig = function(value) {
  return jspb.Message.setWrapperField(this, 12, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.emery.agents.SkillStep} returns this
 */
proto.emery.agents.SkillStep.prototype.clearRetryConfig = function() {
  return this.setRetryConfig(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.emery.agents.SkillStep.prototype.hasRetryConfig = function() {
  return jspb.Message.getField(this, 12) != null;
};


/**
 * repeated StepOutput step_outputs = 13;
 * @return {!Array<!proto.emery.agents.StepOutput>}
 */
proto.emery.agents.SkillStep.prototype.getStepOutputsList = function() {
  return /** @type{!Array<!proto.emery.agents.StepOutput>} */ (
    jspb.Message.getRepeatedWrapperField(this, proto.emery.agents.StepOutput, 13));
};


/**
 * @param {!Array<!proto.emery.agents.StepOutput>} value
 * @return {!proto.emery.agents.SkillStep} returns this
*/
proto.emery.agents.SkillStep.prototype.setStepOutputsList = function(value) {
  return jspb.Message.setRepeatedWrapperField(this, 13, value);
};


/**
 * @param {!proto.emery.agents.StepOutput=} opt_value
 * @param {number=} opt_index
 * @return {!proto.emery.agents.StepOutput}
 */
proto.emery.agents.SkillStep.prototype.addStepOutputs = function(opt_value, opt_index) {
  return jspb.Message.addToRepeatedWrapperField(this, 13, opt_value, proto.emery.agents.StepOutput, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.emery.agents.SkillStep} returns this
 */
proto.emery.agents.SkillStep.prototype.clearStepOutputsList = function() {
  return this.setStepOutputsList([]);
};


/**
 * optional string parallel_group = 14;
 * @return {string}
 */
proto.emery.agents.SkillStep.prototype.getParallelGroup = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 14, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.SkillStep} returns this
 */
proto.emery.agents.SkillStep.prototype.setParallelGroup = function(value) {
  return jspb.Message.setProto3StringField(this, 14, value);
};


/**
 * optional LoopConfig loop_config = 15;
 * @return {?proto.emery.agents.LoopConfig}
 */
proto.emery.agents.SkillStep.prototype.getLoopConfig = function() {
  return /** @type{?proto.emery.agents.LoopConfig} */ (
    jspb.Message.getWrapperField(this, proto.emery.agents.LoopConfig, 15));
};


/**
 * @param {?proto.emery.agents.LoopConfig|undefined} value
 * @return {!proto.emery.agents.SkillStep} returns this
*/
proto.emery.agents.SkillStep.prototype.setLoopConfig = function(value) {
  return jspb.Message.setWrapperField(this, 15, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.emery.agents.SkillStep} returns this
 */
proto.emery.agents.SkillStep.prototype.clearLoopConfig = function() {
  return this.setLoopConfig(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.emery.agents.SkillStep.prototype.hasLoopConfig = function() {
  return jspb.Message.getField(this, 15) != null;
};


/**
 * optional ReadConfig read_config = 16;
 * @return {?proto.emery.agents.ReadConfig}
 */
proto.emery.agents.SkillStep.prototype.getReadConfig = function() {
  return /** @type{?proto.emery.agents.ReadConfig} */ (
    jspb.Message.getWrapperField(this, proto.emery.agents.ReadConfig, 16));
};


/**
 * @param {?proto.emery.agents.ReadConfig|undefined} value
 * @return {!proto.emery.agents.SkillStep} returns this
*/
proto.emery.agents.SkillStep.prototype.setReadConfig = function(value) {
  return jspb.Message.setWrapperField(this, 16, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.emery.agents.SkillStep} returns this
 */
proto.emery.agents.SkillStep.prototype.clearReadConfig = function() {
  return this.setReadConfig(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.emery.agents.SkillStep.prototype.hasReadConfig = function() {
  return jspb.Message.getField(this, 16) != null;
};


/**
 * optional WriteConfig write_config = 17;
 * @return {?proto.emery.agents.WriteConfig}
 */
proto.emery.agents.SkillStep.prototype.getWriteConfig = function() {
  return /** @type{?proto.emery.agents.WriteConfig} */ (
    jspb.Message.getWrapperField(this, proto.emery.agents.WriteConfig, 17));
};


/**
 * @param {?proto.emery.agents.WriteConfig|undefined} value
 * @return {!proto.emery.agents.SkillStep} returns this
*/
proto.emery.agents.SkillStep.prototype.setWriteConfig = function(value) {
  return jspb.Message.setWrapperField(this, 17, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.emery.agents.SkillStep} returns this
 */
proto.emery.agents.SkillStep.prototype.clearWriteConfig = function() {
  return this.setWriteConfig(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.emery.agents.SkillStep.prototype.hasWriteConfig = function() {
  return jspb.Message.getField(this, 17) != null;
};


/**
 * optional ToolExecutionConfig tool_execution_config = 18;
 * @return {?proto.emery.agents.ToolExecutionConfig}
 */
proto.emery.agents.SkillStep.prototype.getToolExecutionConfig = function() {
  return /** @type{?proto.emery.agents.ToolExecutionConfig} */ (
    jspb.Message.getWrapperField(this, proto.emery.agents.ToolExecutionConfig, 18));
};


/**
 * @param {?proto.emery.agents.ToolExecutionConfig|undefined} value
 * @return {!proto.emery.agents.SkillStep} returns this
*/
proto.emery.agents.SkillStep.prototype.setToolExecutionConfig = function(value) {
  return jspb.Message.setWrapperField(this, 18, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.emery.agents.SkillStep} returns this
 */
proto.emery.agents.SkillStep.prototype.clearToolExecutionConfig = function() {
  return this.setToolExecutionConfig(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.emery.agents.SkillStep.prototype.hasToolExecutionConfig = function() {
  return jspb.Message.getField(this, 18) != null;
};


/**
 * optional TaskModelConfig task_model_config = 19;
 * @return {?proto.emery.agents.TaskModelConfig}
 */
proto.emery.agents.SkillStep.prototype.getTaskModelConfig = function() {
  return /** @type{?proto.emery.agents.TaskModelConfig} */ (
    jspb.Message.getWrapperField(this, proto.emery.agents.TaskModelConfig, 19));
};


/**
 * @param {?proto.emery.agents.TaskModelConfig|undefined} value
 * @return {!proto.emery.agents.SkillStep} returns this
*/
proto.emery.agents.SkillStep.prototype.setTaskModelConfig = function(value) {
  return jspb.Message.setWrapperField(this, 19, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.emery.agents.SkillStep} returns this
 */
proto.emery.agents.SkillStep.prototype.clearTaskModelConfig = function() {
  return this.setTaskModelConfig(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.emery.agents.SkillStep.prototype.hasTaskModelConfig = function() {
  return jspb.Message.getField(this, 19) != null;
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.emery.agents.TaskModelConfig.prototype.toObject = function(opt_includeInstance) {
  return proto.emery.agents.TaskModelConfig.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.emery.agents.TaskModelConfig} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.TaskModelConfig.toObject = function(includeInstance, msg) {
  var f, obj = {
    modelId: jspb.Message.getFieldWithDefault(msg, 1, ""),
    taskType: jspb.Message.getFieldWithDefault(msg, 2, ""),
    parametersMap: (f = msg.getParametersMap()) ? f.toObject(includeInstance, undefined) : []
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.emery.agents.TaskModelConfig}
 */
proto.emery.agents.TaskModelConfig.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.emery.agents.TaskModelConfig;
  return proto.emery.agents.TaskModelConfig.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.emery.agents.TaskModelConfig} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.emery.agents.TaskModelConfig}
 */
proto.emery.agents.TaskModelConfig.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setModelId(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setTaskType(value);
      break;
    case 3:
      var value = msg.getParametersMap();
      reader.readMessage(value, function(message, reader) {
        jspb.Map.deserializeBinary(message, reader, jspb.BinaryReader.prototype.readString, jspb.BinaryReader.prototype.readString, null, "", "");
         });
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.emery.agents.TaskModelConfig.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.emery.agents.TaskModelConfig.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.emery.agents.TaskModelConfig} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.TaskModelConfig.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getModelId();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getTaskType();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
  f = message.getParametersMap(true);
  if (f && f.getLength() > 0) {
    f.serializeBinary(3, writer, jspb.BinaryWriter.prototype.writeString, jspb.BinaryWriter.prototype.writeString);
  }
};


/**
 * optional string model_id = 1;
 * @return {string}
 */
proto.emery.agents.TaskModelConfig.prototype.getModelId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.TaskModelConfig} returns this
 */
proto.emery.agents.TaskModelConfig.prototype.setModelId = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional string task_type = 2;
 * @return {string}
 */
proto.emery.agents.TaskModelConfig.prototype.getTaskType = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.TaskModelConfig} returns this
 */
proto.emery.agents.TaskModelConfig.prototype.setTaskType = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};


/**
 * map<string, string> parameters = 3;
 * @param {boolean=} opt_noLazyCreate Do not create the map if
 * empty, instead returning `undefined`
 * @return {!jspb.Map<string,string>}
 */
proto.emery.agents.TaskModelConfig.prototype.getParametersMap = function(opt_noLazyCreate) {
  return /** @type {!jspb.Map<string,string>} */ (
      jspb.Message.getMapField(this, 3, opt_noLazyCreate,
      null));
};


/**
 * Clears values from the map. The map will be non-null.
 * @return {!proto.emery.agents.TaskModelConfig} returns this
 */
proto.emery.agents.TaskModelConfig.prototype.clearParametersMap = function() {
  this.getParametersMap().clear();
  return this;};



/**
 * List of repeated fields within this message type.
 * @private {!Array<number>}
 * @const
 */
proto.emery.agents.ToolExecutionConfig.repeatedFields_ = [2];



if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.emery.agents.ToolExecutionConfig.prototype.toObject = function(opt_includeInstance) {
  return proto.emery.agents.ToolExecutionConfig.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.emery.agents.ToolExecutionConfig} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.ToolExecutionConfig.toObject = function(includeInstance, msg) {
  var f, obj = {
    toolId: jspb.Message.getFieldWithDefault(msg, 1, ""),
    inputMappingsList: jspb.Message.toObjectList(msg.getInputMappingsList(),
    proto.emery.agents.ToolInputMapping.toObject, includeInstance),
    outputTableId: jspb.Message.getFieldWithDefault(msg, 3, 0)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.emery.agents.ToolExecutionConfig}
 */
proto.emery.agents.ToolExecutionConfig.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.emery.agents.ToolExecutionConfig;
  return proto.emery.agents.ToolExecutionConfig.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.emery.agents.ToolExecutionConfig} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.emery.agents.ToolExecutionConfig}
 */
proto.emery.agents.ToolExecutionConfig.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setToolId(value);
      break;
    case 2:
      var value = new proto.emery.agents.ToolInputMapping;
      reader.readMessage(value,proto.emery.agents.ToolInputMapping.deserializeBinaryFromReader);
      msg.addInputMappings(value);
      break;
    case 3:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setOutputTableId(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.emery.agents.ToolExecutionConfig.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.emery.agents.ToolExecutionConfig.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.emery.agents.ToolExecutionConfig} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.ToolExecutionConfig.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getToolId();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getInputMappingsList();
  if (f.length > 0) {
    writer.writeRepeatedMessage(
      2,
      f,
      proto.emery.agents.ToolInputMapping.serializeBinaryToWriter
    );
  }
  f = /** @type {number} */ (jspb.Message.getField(message, 3));
  if (f != null) {
    writer.writeInt32(
      3,
      f
    );
  }
};


/**
 * optional string tool_id = 1;
 * @return {string}
 */
proto.emery.agents.ToolExecutionConfig.prototype.getToolId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.ToolExecutionConfig} returns this
 */
proto.emery.agents.ToolExecutionConfig.prototype.setToolId = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * repeated ToolInputMapping input_mappings = 2;
 * @return {!Array<!proto.emery.agents.ToolInputMapping>}
 */
proto.emery.agents.ToolExecutionConfig.prototype.getInputMappingsList = function() {
  return /** @type{!Array<!proto.emery.agents.ToolInputMapping>} */ (
    jspb.Message.getRepeatedWrapperField(this, proto.emery.agents.ToolInputMapping, 2));
};


/**
 * @param {!Array<!proto.emery.agents.ToolInputMapping>} value
 * @return {!proto.emery.agents.ToolExecutionConfig} returns this
*/
proto.emery.agents.ToolExecutionConfig.prototype.setInputMappingsList = function(value) {
  return jspb.Message.setRepeatedWrapperField(this, 2, value);
};


/**
 * @param {!proto.emery.agents.ToolInputMapping=} opt_value
 * @param {number=} opt_index
 * @return {!proto.emery.agents.ToolInputMapping}
 */
proto.emery.agents.ToolExecutionConfig.prototype.addInputMappings = function(opt_value, opt_index) {
  return jspb.Message.addToRepeatedWrapperField(this, 2, opt_value, proto.emery.agents.ToolInputMapping, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.emery.agents.ToolExecutionConfig} returns this
 */
proto.emery.agents.ToolExecutionConfig.prototype.clearInputMappingsList = function() {
  return this.setInputMappingsList([]);
};


/**
 * optional int32 output_table_id = 3;
 * @return {number}
 */
proto.emery.agents.ToolExecutionConfig.prototype.getOutputTableId = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 3, 0));
};


/**
 * @param {number} value
 * @return {!proto.emery.agents.ToolExecutionConfig} returns this
 */
proto.emery.agents.ToolExecutionConfig.prototype.setOutputTableId = function(value) {
  return jspb.Message.setField(this, 3, value);
};


/**
 * Clears the field making it undefined.
 * @return {!proto.emery.agents.ToolExecutionConfig} returns this
 */
proto.emery.agents.ToolExecutionConfig.prototype.clearOutputTableId = function() {
  return jspb.Message.setField(this, 3, undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.emery.agents.ToolExecutionConfig.prototype.hasOutputTableId = function() {
  return jspb.Message.getField(this, 3) != null;
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.emery.agents.ToolInputMapping.prototype.toObject = function(opt_includeInstance) {
  return proto.emery.agents.ToolInputMapping.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.emery.agents.ToolInputMapping} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.ToolInputMapping.toObject = function(includeInstance, msg) {
  var f, obj = {
    toolParam: jspb.Message.getFieldWithDefault(msg, 1, ""),
    skillInputName: jspb.Message.getFieldWithDefault(msg, 2, ""),
    staticValue: jspb.Message.getFieldWithDefault(msg, 3, "")
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.emery.agents.ToolInputMapping}
 */
proto.emery.agents.ToolInputMapping.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.emery.agents.ToolInputMapping;
  return proto.emery.agents.ToolInputMapping.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.emery.agents.ToolInputMapping} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.emery.agents.ToolInputMapping}
 */
proto.emery.agents.ToolInputMapping.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setToolParam(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setSkillInputName(value);
      break;
    case 3:
      var value = /** @type {string} */ (reader.readString());
      msg.setStaticValue(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.emery.agents.ToolInputMapping.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.emery.agents.ToolInputMapping.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.emery.agents.ToolInputMapping} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.ToolInputMapping.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getToolParam();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getSkillInputName();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
  f = message.getStaticValue();
  if (f.length > 0) {
    writer.writeString(
      3,
      f
    );
  }
};


/**
 * optional string tool_param = 1;
 * @return {string}
 */
proto.emery.agents.ToolInputMapping.prototype.getToolParam = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.ToolInputMapping} returns this
 */
proto.emery.agents.ToolInputMapping.prototype.setToolParam = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional string skill_input_name = 2;
 * @return {string}
 */
proto.emery.agents.ToolInputMapping.prototype.getSkillInputName = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.ToolInputMapping} returns this
 */
proto.emery.agents.ToolInputMapping.prototype.setSkillInputName = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};


/**
 * optional string static_value = 3;
 * @return {string}
 */
proto.emery.agents.ToolInputMapping.prototype.getStaticValue = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 3, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.ToolInputMapping} returns this
 */
proto.emery.agents.ToolInputMapping.prototype.setStaticValue = function(value) {
  return jspb.Message.setProto3StringField(this, 3, value);
};



/**
 * List of repeated fields within this message type.
 * @private {!Array<number>}
 * @const
 */
proto.emery.agents.WriteConfig.repeatedFields_ = [3];



if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.emery.agents.WriteConfig.prototype.toObject = function(opt_includeInstance) {
  return proto.emery.agents.WriteConfig.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.emery.agents.WriteConfig} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.WriteConfig.toObject = function(includeInstance, msg) {
  var f, obj = {
    targetTableId: jspb.Message.getFieldWithDefault(msg, 1, 0),
    rowAction: jspb.Message.getFieldWithDefault(msg, 2, ""),
    fieldMappingsList: jspb.Message.toObjectList(msg.getFieldMappingsList(),
    proto.emery.agents.WriteFieldMapping.toObject, includeInstance),
    updateMatch: (f = msg.getUpdateMatch()) && proto.emery.agents.UpdateMatchConfig.toObject(includeInstance, f)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.emery.agents.WriteConfig}
 */
proto.emery.agents.WriteConfig.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.emery.agents.WriteConfig;
  return proto.emery.agents.WriteConfig.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.emery.agents.WriteConfig} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.emery.agents.WriteConfig}
 */
proto.emery.agents.WriteConfig.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setTargetTableId(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setRowAction(value);
      break;
    case 3:
      var value = new proto.emery.agents.WriteFieldMapping;
      reader.readMessage(value,proto.emery.agents.WriteFieldMapping.deserializeBinaryFromReader);
      msg.addFieldMappings(value);
      break;
    case 4:
      var value = new proto.emery.agents.UpdateMatchConfig;
      reader.readMessage(value,proto.emery.agents.UpdateMatchConfig.deserializeBinaryFromReader);
      msg.setUpdateMatch(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.emery.agents.WriteConfig.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.emery.agents.WriteConfig.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.emery.agents.WriteConfig} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.WriteConfig.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getTargetTableId();
  if (f !== 0) {
    writer.writeInt32(
      1,
      f
    );
  }
  f = message.getRowAction();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
  f = message.getFieldMappingsList();
  if (f.length > 0) {
    writer.writeRepeatedMessage(
      3,
      f,
      proto.emery.agents.WriteFieldMapping.serializeBinaryToWriter
    );
  }
  f = message.getUpdateMatch();
  if (f != null) {
    writer.writeMessage(
      4,
      f,
      proto.emery.agents.UpdateMatchConfig.serializeBinaryToWriter
    );
  }
};


/**
 * optional int32 target_table_id = 1;
 * @return {number}
 */
proto.emery.agents.WriteConfig.prototype.getTargetTableId = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 1, 0));
};


/**
 * @param {number} value
 * @return {!proto.emery.agents.WriteConfig} returns this
 */
proto.emery.agents.WriteConfig.prototype.setTargetTableId = function(value) {
  return jspb.Message.setProto3IntField(this, 1, value);
};


/**
 * optional string row_action = 2;
 * @return {string}
 */
proto.emery.agents.WriteConfig.prototype.getRowAction = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.WriteConfig} returns this
 */
proto.emery.agents.WriteConfig.prototype.setRowAction = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};


/**
 * repeated WriteFieldMapping field_mappings = 3;
 * @return {!Array<!proto.emery.agents.WriteFieldMapping>}
 */
proto.emery.agents.WriteConfig.prototype.getFieldMappingsList = function() {
  return /** @type{!Array<!proto.emery.agents.WriteFieldMapping>} */ (
    jspb.Message.getRepeatedWrapperField(this, proto.emery.agents.WriteFieldMapping, 3));
};


/**
 * @param {!Array<!proto.emery.agents.WriteFieldMapping>} value
 * @return {!proto.emery.agents.WriteConfig} returns this
*/
proto.emery.agents.WriteConfig.prototype.setFieldMappingsList = function(value) {
  return jspb.Message.setRepeatedWrapperField(this, 3, value);
};


/**
 * @param {!proto.emery.agents.WriteFieldMapping=} opt_value
 * @param {number=} opt_index
 * @return {!proto.emery.agents.WriteFieldMapping}
 */
proto.emery.agents.WriteConfig.prototype.addFieldMappings = function(opt_value, opt_index) {
  return jspb.Message.addToRepeatedWrapperField(this, 3, opt_value, proto.emery.agents.WriteFieldMapping, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.emery.agents.WriteConfig} returns this
 */
proto.emery.agents.WriteConfig.prototype.clearFieldMappingsList = function() {
  return this.setFieldMappingsList([]);
};


/**
 * optional UpdateMatchConfig update_match = 4;
 * @return {?proto.emery.agents.UpdateMatchConfig}
 */
proto.emery.agents.WriteConfig.prototype.getUpdateMatch = function() {
  return /** @type{?proto.emery.agents.UpdateMatchConfig} */ (
    jspb.Message.getWrapperField(this, proto.emery.agents.UpdateMatchConfig, 4));
};


/**
 * @param {?proto.emery.agents.UpdateMatchConfig|undefined} value
 * @return {!proto.emery.agents.WriteConfig} returns this
*/
proto.emery.agents.WriteConfig.prototype.setUpdateMatch = function(value) {
  return jspb.Message.setWrapperField(this, 4, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.emery.agents.WriteConfig} returns this
 */
proto.emery.agents.WriteConfig.prototype.clearUpdateMatch = function() {
  return this.setUpdateMatch(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.emery.agents.WriteConfig.prototype.hasUpdateMatch = function() {
  return jspb.Message.getField(this, 4) != null;
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.emery.agents.WriteFieldMapping.prototype.toObject = function(opt_includeInstance) {
  return proto.emery.agents.WriteFieldMapping.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.emery.agents.WriteFieldMapping} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.WriteFieldMapping.toObject = function(includeInstance, msg) {
  var f, obj = {
    skillInputName: jspb.Message.getFieldWithDefault(msg, 1, ""),
    targetFieldId: jspb.Message.getFieldWithDefault(msg, 2, 0)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.emery.agents.WriteFieldMapping}
 */
proto.emery.agents.WriteFieldMapping.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.emery.agents.WriteFieldMapping;
  return proto.emery.agents.WriteFieldMapping.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.emery.agents.WriteFieldMapping} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.emery.agents.WriteFieldMapping}
 */
proto.emery.agents.WriteFieldMapping.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setSkillInputName(value);
      break;
    case 2:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setTargetFieldId(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.emery.agents.WriteFieldMapping.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.emery.agents.WriteFieldMapping.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.emery.agents.WriteFieldMapping} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.WriteFieldMapping.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getSkillInputName();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getTargetFieldId();
  if (f !== 0) {
    writer.writeInt32(
      2,
      f
    );
  }
};


/**
 * optional string skill_input_name = 1;
 * @return {string}
 */
proto.emery.agents.WriteFieldMapping.prototype.getSkillInputName = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.WriteFieldMapping} returns this
 */
proto.emery.agents.WriteFieldMapping.prototype.setSkillInputName = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional int32 target_field_id = 2;
 * @return {number}
 */
proto.emery.agents.WriteFieldMapping.prototype.getTargetFieldId = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 2, 0));
};


/**
 * @param {number} value
 * @return {!proto.emery.agents.WriteFieldMapping} returns this
 */
proto.emery.agents.WriteFieldMapping.prototype.setTargetFieldId = function(value) {
  return jspb.Message.setProto3IntField(this, 2, value);
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.emery.agents.UpdateMatchConfig.prototype.toObject = function(opt_includeInstance) {
  return proto.emery.agents.UpdateMatchConfig.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.emery.agents.UpdateMatchConfig} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.UpdateMatchConfig.toObject = function(includeInstance, msg) {
  var f, obj = {
    skillInputName: jspb.Message.getFieldWithDefault(msg, 1, ""),
    targetFieldId: jspb.Message.getFieldWithDefault(msg, 2, 0)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.emery.agents.UpdateMatchConfig}
 */
proto.emery.agents.UpdateMatchConfig.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.emery.agents.UpdateMatchConfig;
  return proto.emery.agents.UpdateMatchConfig.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.emery.agents.UpdateMatchConfig} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.emery.agents.UpdateMatchConfig}
 */
proto.emery.agents.UpdateMatchConfig.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setSkillInputName(value);
      break;
    case 2:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setTargetFieldId(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.emery.agents.UpdateMatchConfig.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.emery.agents.UpdateMatchConfig.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.emery.agents.UpdateMatchConfig} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.UpdateMatchConfig.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getSkillInputName();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getTargetFieldId();
  if (f !== 0) {
    writer.writeInt32(
      2,
      f
    );
  }
};


/**
 * optional string skill_input_name = 1;
 * @return {string}
 */
proto.emery.agents.UpdateMatchConfig.prototype.getSkillInputName = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.UpdateMatchConfig} returns this
 */
proto.emery.agents.UpdateMatchConfig.prototype.setSkillInputName = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional int32 target_field_id = 2;
 * @return {number}
 */
proto.emery.agents.UpdateMatchConfig.prototype.getTargetFieldId = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 2, 0));
};


/**
 * @param {number} value
 * @return {!proto.emery.agents.UpdateMatchConfig} returns this
 */
proto.emery.agents.UpdateMatchConfig.prototype.setTargetFieldId = function(value) {
  return jspb.Message.setProto3IntField(this, 2, value);
};



/**
 * List of repeated fields within this message type.
 * @private {!Array<number>}
 * @const
 */
proto.emery.agents.ReadConfig.repeatedFields_ = [4,6];



if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.emery.agents.ReadConfig.prototype.toObject = function(opt_includeInstance) {
  return proto.emery.agents.ReadConfig.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.emery.agents.ReadConfig} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.ReadConfig.toObject = function(includeInstance, msg) {
  var f, obj = {
    mode: jspb.Message.getFieldWithDefault(msg, 1, ""),
    sourceTableId: jspb.Message.getFieldWithDefault(msg, 2, 0),
    rowIdSource: (f = msg.getRowIdSource()) && proto.emery.agents.RowIdSource.toObject(includeInstance, f),
    queryFiltersList: jspb.Message.toObjectList(msg.getQueryFiltersList(),
    proto.emery.agents.QueryFilter.toObject, includeInstance),
    queryLimit: jspb.Message.getFieldWithDefault(msg, 5, 0),
    fieldMappingsList: jspb.Message.toObjectList(msg.getFieldMappingsList(),
    proto.emery.agents.ReadFieldMapping.toObject, includeInstance)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.emery.agents.ReadConfig}
 */
proto.emery.agents.ReadConfig.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.emery.agents.ReadConfig;
  return proto.emery.agents.ReadConfig.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.emery.agents.ReadConfig} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.emery.agents.ReadConfig}
 */
proto.emery.agents.ReadConfig.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setMode(value);
      break;
    case 2:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setSourceTableId(value);
      break;
    case 3:
      var value = new proto.emery.agents.RowIdSource;
      reader.readMessage(value,proto.emery.agents.RowIdSource.deserializeBinaryFromReader);
      msg.setRowIdSource(value);
      break;
    case 4:
      var value = new proto.emery.agents.QueryFilter;
      reader.readMessage(value,proto.emery.agents.QueryFilter.deserializeBinaryFromReader);
      msg.addQueryFilters(value);
      break;
    case 5:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setQueryLimit(value);
      break;
    case 6:
      var value = new proto.emery.agents.ReadFieldMapping;
      reader.readMessage(value,proto.emery.agents.ReadFieldMapping.deserializeBinaryFromReader);
      msg.addFieldMappings(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.emery.agents.ReadConfig.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.emery.agents.ReadConfig.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.emery.agents.ReadConfig} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.ReadConfig.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getMode();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getSourceTableId();
  if (f !== 0) {
    writer.writeInt32(
      2,
      f
    );
  }
  f = message.getRowIdSource();
  if (f != null) {
    writer.writeMessage(
      3,
      f,
      proto.emery.agents.RowIdSource.serializeBinaryToWriter
    );
  }
  f = message.getQueryFiltersList();
  if (f.length > 0) {
    writer.writeRepeatedMessage(
      4,
      f,
      proto.emery.agents.QueryFilter.serializeBinaryToWriter
    );
  }
  f = message.getQueryLimit();
  if (f !== 0) {
    writer.writeInt32(
      5,
      f
    );
  }
  f = message.getFieldMappingsList();
  if (f.length > 0) {
    writer.writeRepeatedMessage(
      6,
      f,
      proto.emery.agents.ReadFieldMapping.serializeBinaryToWriter
    );
  }
};


/**
 * optional string mode = 1;
 * @return {string}
 */
proto.emery.agents.ReadConfig.prototype.getMode = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.ReadConfig} returns this
 */
proto.emery.agents.ReadConfig.prototype.setMode = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional int32 source_table_id = 2;
 * @return {number}
 */
proto.emery.agents.ReadConfig.prototype.getSourceTableId = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 2, 0));
};


/**
 * @param {number} value
 * @return {!proto.emery.agents.ReadConfig} returns this
 */
proto.emery.agents.ReadConfig.prototype.setSourceTableId = function(value) {
  return jspb.Message.setProto3IntField(this, 2, value);
};


/**
 * optional RowIdSource row_id_source = 3;
 * @return {?proto.emery.agents.RowIdSource}
 */
proto.emery.agents.ReadConfig.prototype.getRowIdSource = function() {
  return /** @type{?proto.emery.agents.RowIdSource} */ (
    jspb.Message.getWrapperField(this, proto.emery.agents.RowIdSource, 3));
};


/**
 * @param {?proto.emery.agents.RowIdSource|undefined} value
 * @return {!proto.emery.agents.ReadConfig} returns this
*/
proto.emery.agents.ReadConfig.prototype.setRowIdSource = function(value) {
  return jspb.Message.setWrapperField(this, 3, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.emery.agents.ReadConfig} returns this
 */
proto.emery.agents.ReadConfig.prototype.clearRowIdSource = function() {
  return this.setRowIdSource(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.emery.agents.ReadConfig.prototype.hasRowIdSource = function() {
  return jspb.Message.getField(this, 3) != null;
};


/**
 * repeated QueryFilter query_filters = 4;
 * @return {!Array<!proto.emery.agents.QueryFilter>}
 */
proto.emery.agents.ReadConfig.prototype.getQueryFiltersList = function() {
  return /** @type{!Array<!proto.emery.agents.QueryFilter>} */ (
    jspb.Message.getRepeatedWrapperField(this, proto.emery.agents.QueryFilter, 4));
};


/**
 * @param {!Array<!proto.emery.agents.QueryFilter>} value
 * @return {!proto.emery.agents.ReadConfig} returns this
*/
proto.emery.agents.ReadConfig.prototype.setQueryFiltersList = function(value) {
  return jspb.Message.setRepeatedWrapperField(this, 4, value);
};


/**
 * @param {!proto.emery.agents.QueryFilter=} opt_value
 * @param {number=} opt_index
 * @return {!proto.emery.agents.QueryFilter}
 */
proto.emery.agents.ReadConfig.prototype.addQueryFilters = function(opt_value, opt_index) {
  return jspb.Message.addToRepeatedWrapperField(this, 4, opt_value, proto.emery.agents.QueryFilter, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.emery.agents.ReadConfig} returns this
 */
proto.emery.agents.ReadConfig.prototype.clearQueryFiltersList = function() {
  return this.setQueryFiltersList([]);
};


/**
 * optional int32 query_limit = 5;
 * @return {number}
 */
proto.emery.agents.ReadConfig.prototype.getQueryLimit = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 5, 0));
};


/**
 * @param {number} value
 * @return {!proto.emery.agents.ReadConfig} returns this
 */
proto.emery.agents.ReadConfig.prototype.setQueryLimit = function(value) {
  return jspb.Message.setProto3IntField(this, 5, value);
};


/**
 * repeated ReadFieldMapping field_mappings = 6;
 * @return {!Array<!proto.emery.agents.ReadFieldMapping>}
 */
proto.emery.agents.ReadConfig.prototype.getFieldMappingsList = function() {
  return /** @type{!Array<!proto.emery.agents.ReadFieldMapping>} */ (
    jspb.Message.getRepeatedWrapperField(this, proto.emery.agents.ReadFieldMapping, 6));
};


/**
 * @param {!Array<!proto.emery.agents.ReadFieldMapping>} value
 * @return {!proto.emery.agents.ReadConfig} returns this
*/
proto.emery.agents.ReadConfig.prototype.setFieldMappingsList = function(value) {
  return jspb.Message.setRepeatedWrapperField(this, 6, value);
};


/**
 * @param {!proto.emery.agents.ReadFieldMapping=} opt_value
 * @param {number=} opt_index
 * @return {!proto.emery.agents.ReadFieldMapping}
 */
proto.emery.agents.ReadConfig.prototype.addFieldMappings = function(opt_value, opt_index) {
  return jspb.Message.addToRepeatedWrapperField(this, 6, opt_value, proto.emery.agents.ReadFieldMapping, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.emery.agents.ReadConfig} returns this
 */
proto.emery.agents.ReadConfig.prototype.clearFieldMappingsList = function() {
  return this.setFieldMappingsList([]);
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.emery.agents.QueryFilter.prototype.toObject = function(opt_includeInstance) {
  return proto.emery.agents.QueryFilter.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.emery.agents.QueryFilter} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.QueryFilter.toObject = function(includeInstance, msg) {
  var f, obj = {
    fieldId: jspb.Message.getFieldWithDefault(msg, 1, 0),
    operator: jspb.Message.getFieldWithDefault(msg, 2, ""),
    valueSource: (f = msg.getValueSource()) && proto.emery.agents.RowIdSource.toObject(includeInstance, f)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.emery.agents.QueryFilter}
 */
proto.emery.agents.QueryFilter.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.emery.agents.QueryFilter;
  return proto.emery.agents.QueryFilter.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.emery.agents.QueryFilter} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.emery.agents.QueryFilter}
 */
proto.emery.agents.QueryFilter.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setFieldId(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setOperator(value);
      break;
    case 3:
      var value = new proto.emery.agents.RowIdSource;
      reader.readMessage(value,proto.emery.agents.RowIdSource.deserializeBinaryFromReader);
      msg.setValueSource(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.emery.agents.QueryFilter.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.emery.agents.QueryFilter.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.emery.agents.QueryFilter} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.QueryFilter.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getFieldId();
  if (f !== 0) {
    writer.writeInt32(
      1,
      f
    );
  }
  f = message.getOperator();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
  f = message.getValueSource();
  if (f != null) {
    writer.writeMessage(
      3,
      f,
      proto.emery.agents.RowIdSource.serializeBinaryToWriter
    );
  }
};


/**
 * optional int32 field_id = 1;
 * @return {number}
 */
proto.emery.agents.QueryFilter.prototype.getFieldId = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 1, 0));
};


/**
 * @param {number} value
 * @return {!proto.emery.agents.QueryFilter} returns this
 */
proto.emery.agents.QueryFilter.prototype.setFieldId = function(value) {
  return jspb.Message.setProto3IntField(this, 1, value);
};


/**
 * optional string operator = 2;
 * @return {string}
 */
proto.emery.agents.QueryFilter.prototype.getOperator = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.QueryFilter} returns this
 */
proto.emery.agents.QueryFilter.prototype.setOperator = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};


/**
 * optional RowIdSource value_source = 3;
 * @return {?proto.emery.agents.RowIdSource}
 */
proto.emery.agents.QueryFilter.prototype.getValueSource = function() {
  return /** @type{?proto.emery.agents.RowIdSource} */ (
    jspb.Message.getWrapperField(this, proto.emery.agents.RowIdSource, 3));
};


/**
 * @param {?proto.emery.agents.RowIdSource|undefined} value
 * @return {!proto.emery.agents.QueryFilter} returns this
*/
proto.emery.agents.QueryFilter.prototype.setValueSource = function(value) {
  return jspb.Message.setWrapperField(this, 3, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.emery.agents.QueryFilter} returns this
 */
proto.emery.agents.QueryFilter.prototype.clearValueSource = function() {
  return this.setValueSource(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.emery.agents.QueryFilter.prototype.hasValueSource = function() {
  return jspb.Message.getField(this, 3) != null;
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.emery.agents.ReadFieldMapping.prototype.toObject = function(opt_includeInstance) {
  return proto.emery.agents.ReadFieldMapping.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.emery.agents.ReadFieldMapping} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.ReadFieldMapping.toObject = function(includeInstance, msg) {
  var f, obj = {
    sourceFieldId: jspb.Message.getFieldWithDefault(msg, 1, 0),
    targetVariable: jspb.Message.getFieldWithDefault(msg, 2, "")
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.emery.agents.ReadFieldMapping}
 */
proto.emery.agents.ReadFieldMapping.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.emery.agents.ReadFieldMapping;
  return proto.emery.agents.ReadFieldMapping.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.emery.agents.ReadFieldMapping} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.emery.agents.ReadFieldMapping}
 */
proto.emery.agents.ReadFieldMapping.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setSourceFieldId(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setTargetVariable(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.emery.agents.ReadFieldMapping.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.emery.agents.ReadFieldMapping.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.emery.agents.ReadFieldMapping} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.ReadFieldMapping.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getSourceFieldId();
  if (f !== 0) {
    writer.writeInt32(
      1,
      f
    );
  }
  f = message.getTargetVariable();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
};


/**
 * optional int32 source_field_id = 1;
 * @return {number}
 */
proto.emery.agents.ReadFieldMapping.prototype.getSourceFieldId = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 1, 0));
};


/**
 * @param {number} value
 * @return {!proto.emery.agents.ReadFieldMapping} returns this
 */
proto.emery.agents.ReadFieldMapping.prototype.setSourceFieldId = function(value) {
  return jspb.Message.setProto3IntField(this, 1, value);
};


/**
 * optional string target_variable = 2;
 * @return {string}
 */
proto.emery.agents.ReadFieldMapping.prototype.getTargetVariable = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.ReadFieldMapping} returns this
 */
proto.emery.agents.ReadFieldMapping.prototype.setTargetVariable = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};



/**
 * List of repeated fields within this message type.
 * @private {!Array<number>}
 * @const
 */
proto.emery.agents.TargetFieldMetadata.repeatedFields_ = [2];



if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.emery.agents.TargetFieldMetadata.prototype.toObject = function(opt_includeInstance) {
  return proto.emery.agents.TargetFieldMetadata.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.emery.agents.TargetFieldMetadata} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.TargetFieldMetadata.toObject = function(includeInstance, msg) {
  var f, obj = {
    fieldType: jspb.Message.getFieldWithDefault(msg, 1, ""),
    optionsList: (f = jspb.Message.getRepeatedField(msg, 2)) == null ? undefined : f,
    maxSelections: jspb.Message.getFieldWithDefault(msg, 3, 0),
    fieldName: jspb.Message.getFieldWithDefault(msg, 4, "")
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.emery.agents.TargetFieldMetadata}
 */
proto.emery.agents.TargetFieldMetadata.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.emery.agents.TargetFieldMetadata;
  return proto.emery.agents.TargetFieldMetadata.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.emery.agents.TargetFieldMetadata} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.emery.agents.TargetFieldMetadata}
 */
proto.emery.agents.TargetFieldMetadata.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setFieldType(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.addOptions(value);
      break;
    case 3:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setMaxSelections(value);
      break;
    case 4:
      var value = /** @type {string} */ (reader.readString());
      msg.setFieldName(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.emery.agents.TargetFieldMetadata.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.emery.agents.TargetFieldMetadata.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.emery.agents.TargetFieldMetadata} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.TargetFieldMetadata.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getFieldType();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getOptionsList();
  if (f.length > 0) {
    writer.writeRepeatedString(
      2,
      f
    );
  }
  f = /** @type {number} */ (jspb.Message.getField(message, 3));
  if (f != null) {
    writer.writeInt32(
      3,
      f
    );
  }
  f = /** @type {string} */ (jspb.Message.getField(message, 4));
  if (f != null) {
    writer.writeString(
      4,
      f
    );
  }
};


/**
 * optional string field_type = 1;
 * @return {string}
 */
proto.emery.agents.TargetFieldMetadata.prototype.getFieldType = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.TargetFieldMetadata} returns this
 */
proto.emery.agents.TargetFieldMetadata.prototype.setFieldType = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * repeated string options = 2;
 * @return {!Array<string>}
 */
proto.emery.agents.TargetFieldMetadata.prototype.getOptionsList = function() {
  return /** @type {!Array<string>} */ (jspb.Message.getRepeatedField(this, 2));
};


/**
 * @param {!Array<string>} value
 * @return {!proto.emery.agents.TargetFieldMetadata} returns this
 */
proto.emery.agents.TargetFieldMetadata.prototype.setOptionsList = function(value) {
  return jspb.Message.setField(this, 2, value || []);
};


/**
 * @param {string} value
 * @param {number=} opt_index
 * @return {!proto.emery.agents.TargetFieldMetadata} returns this
 */
proto.emery.agents.TargetFieldMetadata.prototype.addOptions = function(value, opt_index) {
  return jspb.Message.addToRepeatedField(this, 2, value, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.emery.agents.TargetFieldMetadata} returns this
 */
proto.emery.agents.TargetFieldMetadata.prototype.clearOptionsList = function() {
  return this.setOptionsList([]);
};


/**
 * optional int32 max_selections = 3;
 * @return {number}
 */
proto.emery.agents.TargetFieldMetadata.prototype.getMaxSelections = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 3, 0));
};


/**
 * @param {number} value
 * @return {!proto.emery.agents.TargetFieldMetadata} returns this
 */
proto.emery.agents.TargetFieldMetadata.prototype.setMaxSelections = function(value) {
  return jspb.Message.setField(this, 3, value);
};


/**
 * Clears the field making it undefined.
 * @return {!proto.emery.agents.TargetFieldMetadata} returns this
 */
proto.emery.agents.TargetFieldMetadata.prototype.clearMaxSelections = function() {
  return jspb.Message.setField(this, 3, undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.emery.agents.TargetFieldMetadata.prototype.hasMaxSelections = function() {
  return jspb.Message.getField(this, 3) != null;
};


/**
 * optional string field_name = 4;
 * @return {string}
 */
proto.emery.agents.TargetFieldMetadata.prototype.getFieldName = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 4, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.TargetFieldMetadata} returns this
 */
proto.emery.agents.TargetFieldMetadata.prototype.setFieldName = function(value) {
  return jspb.Message.setField(this, 4, value);
};


/**
 * Clears the field making it undefined.
 * @return {!proto.emery.agents.TargetFieldMetadata} returns this
 */
proto.emery.agents.TargetFieldMetadata.prototype.clearFieldName = function() {
  return jspb.Message.setField(this, 4, undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.emery.agents.TargetFieldMetadata.prototype.hasFieldName = function() {
  return jspb.Message.getField(this, 4) != null;
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.emery.agents.TableReference.prototype.toObject = function(opt_includeInstance) {
  return proto.emery.agents.TableReference.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.emery.agents.TableReference} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.TableReference.toObject = function(includeInstance, msg) {
  var f, obj = {
    order: jspb.Message.getFieldWithDefault(msg, 1, 0),
    field: jspb.Message.getFieldWithDefault(msg, 2, "")
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.emery.agents.TableReference}
 */
proto.emery.agents.TableReference.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.emery.agents.TableReference;
  return proto.emery.agents.TableReference.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.emery.agents.TableReference} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.emery.agents.TableReference}
 */
proto.emery.agents.TableReference.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setOrder(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setField(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.emery.agents.TableReference.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.emery.agents.TableReference.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.emery.agents.TableReference} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.TableReference.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getOrder();
  if (f !== 0) {
    writer.writeInt32(
      1,
      f
    );
  }
  f = message.getField();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
};


/**
 * optional int32 order = 1;
 * @return {number}
 */
proto.emery.agents.TableReference.prototype.getOrder = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 1, 0));
};


/**
 * @param {number} value
 * @return {!proto.emery.agents.TableReference} returns this
 */
proto.emery.agents.TableReference.prototype.setOrder = function(value) {
  return jspb.Message.setProto3IntField(this, 1, value);
};


/**
 * optional string field = 2;
 * @return {string}
 */
proto.emery.agents.TableReference.prototype.getField = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.TableReference} returns this
 */
proto.emery.agents.TableReference.prototype.setField = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};



/**
 * Oneof group definitions for this message. Each group defines the field
 * numbers belonging to that group. When of these fields' value is set, all
 * other fields in the group are cleared. During deserialization, if multiple
 * fields are encountered for a group, only the last value seen will be kept.
 * @private {!Array<!Array<number>>}
 * @const
 */
proto.emery.agents.FieldSource.oneofGroups_ = [[1,2,3]];

/**
 * @enum {number}
 */
proto.emery.agents.FieldSource.SourceCase = {
  SOURCE_NOT_SET: 0,
  SKILL_OUTPUT: 1,
  TABLE_REF: 2,
  SKILL_INPUT: 3
};

/**
 * @return {proto.emery.agents.FieldSource.SourceCase}
 */
proto.emery.agents.FieldSource.prototype.getSourceCase = function() {
  return /** @type {proto.emery.agents.FieldSource.SourceCase} */(jspb.Message.computeOneofCase(this, proto.emery.agents.FieldSource.oneofGroups_[0]));
};



if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.emery.agents.FieldSource.prototype.toObject = function(opt_includeInstance) {
  return proto.emery.agents.FieldSource.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.emery.agents.FieldSource} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.FieldSource.toObject = function(includeInstance, msg) {
  var f, obj = {
    skillOutput: jspb.Message.getFieldWithDefault(msg, 1, ""),
    tableRef: (f = msg.getTableRef()) && proto.emery.agents.TableReference.toObject(includeInstance, f),
    skillInput: jspb.Message.getFieldWithDefault(msg, 3, "")
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.emery.agents.FieldSource}
 */
proto.emery.agents.FieldSource.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.emery.agents.FieldSource;
  return proto.emery.agents.FieldSource.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.emery.agents.FieldSource} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.emery.agents.FieldSource}
 */
proto.emery.agents.FieldSource.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setSkillOutput(value);
      break;
    case 2:
      var value = new proto.emery.agents.TableReference;
      reader.readMessage(value,proto.emery.agents.TableReference.deserializeBinaryFromReader);
      msg.setTableRef(value);
      break;
    case 3:
      var value = /** @type {string} */ (reader.readString());
      msg.setSkillInput(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.emery.agents.FieldSource.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.emery.agents.FieldSource.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.emery.agents.FieldSource} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.FieldSource.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = /** @type {string} */ (jspb.Message.getField(message, 1));
  if (f != null) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getTableRef();
  if (f != null) {
    writer.writeMessage(
      2,
      f,
      proto.emery.agents.TableReference.serializeBinaryToWriter
    );
  }
  f = /** @type {string} */ (jspb.Message.getField(message, 3));
  if (f != null) {
    writer.writeString(
      3,
      f
    );
  }
};


/**
 * optional string skill_output = 1;
 * @return {string}
 */
proto.emery.agents.FieldSource.prototype.getSkillOutput = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.FieldSource} returns this
 */
proto.emery.agents.FieldSource.prototype.setSkillOutput = function(value) {
  return jspb.Message.setOneofField(this, 1, proto.emery.agents.FieldSource.oneofGroups_[0], value);
};


/**
 * Clears the field making it undefined.
 * @return {!proto.emery.agents.FieldSource} returns this
 */
proto.emery.agents.FieldSource.prototype.clearSkillOutput = function() {
  return jspb.Message.setOneofField(this, 1, proto.emery.agents.FieldSource.oneofGroups_[0], undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.emery.agents.FieldSource.prototype.hasSkillOutput = function() {
  return jspb.Message.getField(this, 1) != null;
};


/**
 * optional TableReference table_ref = 2;
 * @return {?proto.emery.agents.TableReference}
 */
proto.emery.agents.FieldSource.prototype.getTableRef = function() {
  return /** @type{?proto.emery.agents.TableReference} */ (
    jspb.Message.getWrapperField(this, proto.emery.agents.TableReference, 2));
};


/**
 * @param {?proto.emery.agents.TableReference|undefined} value
 * @return {!proto.emery.agents.FieldSource} returns this
*/
proto.emery.agents.FieldSource.prototype.setTableRef = function(value) {
  return jspb.Message.setOneofWrapperField(this, 2, proto.emery.agents.FieldSource.oneofGroups_[0], value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.emery.agents.FieldSource} returns this
 */
proto.emery.agents.FieldSource.prototype.clearTableRef = function() {
  return this.setTableRef(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.emery.agents.FieldSource.prototype.hasTableRef = function() {
  return jspb.Message.getField(this, 2) != null;
};


/**
 * optional string skill_input = 3;
 * @return {string}
 */
proto.emery.agents.FieldSource.prototype.getSkillInput = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 3, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.FieldSource} returns this
 */
proto.emery.agents.FieldSource.prototype.setSkillInput = function(value) {
  return jspb.Message.setOneofField(this, 3, proto.emery.agents.FieldSource.oneofGroups_[0], value);
};


/**
 * Clears the field making it undefined.
 * @return {!proto.emery.agents.FieldSource} returns this
 */
proto.emery.agents.FieldSource.prototype.clearSkillInput = function() {
  return jspb.Message.setOneofField(this, 3, proto.emery.agents.FieldSource.oneofGroups_[0], undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.emery.agents.FieldSource.prototype.hasSkillInput = function() {
  return jspb.Message.getField(this, 3) != null;
};



/**
 * Oneof group definitions for this message. Each group defines the field
 * numbers belonging to that group. When of these fields' value is set, all
 * other fields in the group are cleared. During deserialization, if multiple
 * fields are encountered for a group, only the last value seen will be kept.
 * @private {!Array<!Array<number>>}
 * @const
 */
proto.emery.agents.RowIdSource.oneofGroups_ = [[1,2,3,4,5]];

/**
 * @enum {number}
 */
proto.emery.agents.RowIdSource.SourceCase = {
  SOURCE_NOT_SET: 0,
  STATIC_ID: 1,
  SKILL_INPUT: 2,
  SKILL_OUTPUT: 3,
  TABLE_REF: 4,
  USE_SOURCE_ROW: 5
};

/**
 * @return {proto.emery.agents.RowIdSource.SourceCase}
 */
proto.emery.agents.RowIdSource.prototype.getSourceCase = function() {
  return /** @type {proto.emery.agents.RowIdSource.SourceCase} */(jspb.Message.computeOneofCase(this, proto.emery.agents.RowIdSource.oneofGroups_[0]));
};



if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.emery.agents.RowIdSource.prototype.toObject = function(opt_includeInstance) {
  return proto.emery.agents.RowIdSource.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.emery.agents.RowIdSource} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.RowIdSource.toObject = function(includeInstance, msg) {
  var f, obj = {
    staticId: jspb.Message.getFieldWithDefault(msg, 1, ""),
    skillInput: jspb.Message.getFieldWithDefault(msg, 2, ""),
    skillOutput: jspb.Message.getFieldWithDefault(msg, 3, ""),
    tableRef: (f = msg.getTableRef()) && proto.emery.agents.TableReference.toObject(includeInstance, f),
    useSourceRow: jspb.Message.getBooleanFieldWithDefault(msg, 5, false)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.emery.agents.RowIdSource}
 */
proto.emery.agents.RowIdSource.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.emery.agents.RowIdSource;
  return proto.emery.agents.RowIdSource.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.emery.agents.RowIdSource} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.emery.agents.RowIdSource}
 */
proto.emery.agents.RowIdSource.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setStaticId(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setSkillInput(value);
      break;
    case 3:
      var value = /** @type {string} */ (reader.readString());
      msg.setSkillOutput(value);
      break;
    case 4:
      var value = new proto.emery.agents.TableReference;
      reader.readMessage(value,proto.emery.agents.TableReference.deserializeBinaryFromReader);
      msg.setTableRef(value);
      break;
    case 5:
      var value = /** @type {boolean} */ (reader.readBool());
      msg.setUseSourceRow(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.emery.agents.RowIdSource.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.emery.agents.RowIdSource.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.emery.agents.RowIdSource} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.RowIdSource.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = /** @type {string} */ (jspb.Message.getField(message, 1));
  if (f != null) {
    writer.writeString(
      1,
      f
    );
  }
  f = /** @type {string} */ (jspb.Message.getField(message, 2));
  if (f != null) {
    writer.writeString(
      2,
      f
    );
  }
  f = /** @type {string} */ (jspb.Message.getField(message, 3));
  if (f != null) {
    writer.writeString(
      3,
      f
    );
  }
  f = message.getTableRef();
  if (f != null) {
    writer.writeMessage(
      4,
      f,
      proto.emery.agents.TableReference.serializeBinaryToWriter
    );
  }
  f = /** @type {boolean} */ (jspb.Message.getField(message, 5));
  if (f != null) {
    writer.writeBool(
      5,
      f
    );
  }
};


/**
 * optional string static_id = 1;
 * @return {string}
 */
proto.emery.agents.RowIdSource.prototype.getStaticId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.RowIdSource} returns this
 */
proto.emery.agents.RowIdSource.prototype.setStaticId = function(value) {
  return jspb.Message.setOneofField(this, 1, proto.emery.agents.RowIdSource.oneofGroups_[0], value);
};


/**
 * Clears the field making it undefined.
 * @return {!proto.emery.agents.RowIdSource} returns this
 */
proto.emery.agents.RowIdSource.prototype.clearStaticId = function() {
  return jspb.Message.setOneofField(this, 1, proto.emery.agents.RowIdSource.oneofGroups_[0], undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.emery.agents.RowIdSource.prototype.hasStaticId = function() {
  return jspb.Message.getField(this, 1) != null;
};


/**
 * optional string skill_input = 2;
 * @return {string}
 */
proto.emery.agents.RowIdSource.prototype.getSkillInput = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.RowIdSource} returns this
 */
proto.emery.agents.RowIdSource.prototype.setSkillInput = function(value) {
  return jspb.Message.setOneofField(this, 2, proto.emery.agents.RowIdSource.oneofGroups_[0], value);
};


/**
 * Clears the field making it undefined.
 * @return {!proto.emery.agents.RowIdSource} returns this
 */
proto.emery.agents.RowIdSource.prototype.clearSkillInput = function() {
  return jspb.Message.setOneofField(this, 2, proto.emery.agents.RowIdSource.oneofGroups_[0], undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.emery.agents.RowIdSource.prototype.hasSkillInput = function() {
  return jspb.Message.getField(this, 2) != null;
};


/**
 * optional string skill_output = 3;
 * @return {string}
 */
proto.emery.agents.RowIdSource.prototype.getSkillOutput = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 3, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.RowIdSource} returns this
 */
proto.emery.agents.RowIdSource.prototype.setSkillOutput = function(value) {
  return jspb.Message.setOneofField(this, 3, proto.emery.agents.RowIdSource.oneofGroups_[0], value);
};


/**
 * Clears the field making it undefined.
 * @return {!proto.emery.agents.RowIdSource} returns this
 */
proto.emery.agents.RowIdSource.prototype.clearSkillOutput = function() {
  return jspb.Message.setOneofField(this, 3, proto.emery.agents.RowIdSource.oneofGroups_[0], undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.emery.agents.RowIdSource.prototype.hasSkillOutput = function() {
  return jspb.Message.getField(this, 3) != null;
};


/**
 * optional TableReference table_ref = 4;
 * @return {?proto.emery.agents.TableReference}
 */
proto.emery.agents.RowIdSource.prototype.getTableRef = function() {
  return /** @type{?proto.emery.agents.TableReference} */ (
    jspb.Message.getWrapperField(this, proto.emery.agents.TableReference, 4));
};


/**
 * @param {?proto.emery.agents.TableReference|undefined} value
 * @return {!proto.emery.agents.RowIdSource} returns this
*/
proto.emery.agents.RowIdSource.prototype.setTableRef = function(value) {
  return jspb.Message.setOneofWrapperField(this, 4, proto.emery.agents.RowIdSource.oneofGroups_[0], value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.emery.agents.RowIdSource} returns this
 */
proto.emery.agents.RowIdSource.prototype.clearTableRef = function() {
  return this.setTableRef(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.emery.agents.RowIdSource.prototype.hasTableRef = function() {
  return jspb.Message.getField(this, 4) != null;
};


/**
 * optional bool use_source_row = 5;
 * @return {boolean}
 */
proto.emery.agents.RowIdSource.prototype.getUseSourceRow = function() {
  return /** @type {boolean} */ (jspb.Message.getBooleanFieldWithDefault(this, 5, false));
};


/**
 * @param {boolean} value
 * @return {!proto.emery.agents.RowIdSource} returns this
 */
proto.emery.agents.RowIdSource.prototype.setUseSourceRow = function(value) {
  return jspb.Message.setOneofField(this, 5, proto.emery.agents.RowIdSource.oneofGroups_[0], value);
};


/**
 * Clears the field making it undefined.
 * @return {!proto.emery.agents.RowIdSource} returns this
 */
proto.emery.agents.RowIdSource.prototype.clearUseSourceRow = function() {
  return jspb.Message.setOneofField(this, 5, proto.emery.agents.RowIdSource.oneofGroups_[0], undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.emery.agents.RowIdSource.prototype.hasUseSourceRow = function() {
  return jspb.Message.getField(this, 5) != null;
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.emery.agents.FieldMapping.prototype.toObject = function(opt_includeInstance) {
  return proto.emery.agents.FieldMapping.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.emery.agents.FieldMapping} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.FieldMapping.toObject = function(includeInstance, msg) {
  var f, obj = {
    source: (f = msg.getSource()) && proto.emery.agents.FieldSource.toObject(includeInstance, f),
    targetFieldId: jspb.Message.getFieldWithDefault(msg, 2, 0),
    targetFieldMetadata: (f = msg.getTargetFieldMetadata()) && proto.emery.agents.TargetFieldMetadata.toObject(includeInstance, f),
    appendMode: jspb.Message.getBooleanFieldWithDefault(msg, 4, false)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.emery.agents.FieldMapping}
 */
proto.emery.agents.FieldMapping.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.emery.agents.FieldMapping;
  return proto.emery.agents.FieldMapping.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.emery.agents.FieldMapping} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.emery.agents.FieldMapping}
 */
proto.emery.agents.FieldMapping.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = new proto.emery.agents.FieldSource;
      reader.readMessage(value,proto.emery.agents.FieldSource.deserializeBinaryFromReader);
      msg.setSource(value);
      break;
    case 2:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setTargetFieldId(value);
      break;
    case 3:
      var value = new proto.emery.agents.TargetFieldMetadata;
      reader.readMessage(value,proto.emery.agents.TargetFieldMetadata.deserializeBinaryFromReader);
      msg.setTargetFieldMetadata(value);
      break;
    case 4:
      var value = /** @type {boolean} */ (reader.readBool());
      msg.setAppendMode(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.emery.agents.FieldMapping.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.emery.agents.FieldMapping.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.emery.agents.FieldMapping} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.FieldMapping.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getSource();
  if (f != null) {
    writer.writeMessage(
      1,
      f,
      proto.emery.agents.FieldSource.serializeBinaryToWriter
    );
  }
  f = message.getTargetFieldId();
  if (f !== 0) {
    writer.writeInt32(
      2,
      f
    );
  }
  f = message.getTargetFieldMetadata();
  if (f != null) {
    writer.writeMessage(
      3,
      f,
      proto.emery.agents.TargetFieldMetadata.serializeBinaryToWriter
    );
  }
  f = message.getAppendMode();
  if (f) {
    writer.writeBool(
      4,
      f
    );
  }
};


/**
 * optional FieldSource source = 1;
 * @return {?proto.emery.agents.FieldSource}
 */
proto.emery.agents.FieldMapping.prototype.getSource = function() {
  return /** @type{?proto.emery.agents.FieldSource} */ (
    jspb.Message.getWrapperField(this, proto.emery.agents.FieldSource, 1));
};


/**
 * @param {?proto.emery.agents.FieldSource|undefined} value
 * @return {!proto.emery.agents.FieldMapping} returns this
*/
proto.emery.agents.FieldMapping.prototype.setSource = function(value) {
  return jspb.Message.setWrapperField(this, 1, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.emery.agents.FieldMapping} returns this
 */
proto.emery.agents.FieldMapping.prototype.clearSource = function() {
  return this.setSource(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.emery.agents.FieldMapping.prototype.hasSource = function() {
  return jspb.Message.getField(this, 1) != null;
};


/**
 * optional int32 target_field_id = 2;
 * @return {number}
 */
proto.emery.agents.FieldMapping.prototype.getTargetFieldId = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 2, 0));
};


/**
 * @param {number} value
 * @return {!proto.emery.agents.FieldMapping} returns this
 */
proto.emery.agents.FieldMapping.prototype.setTargetFieldId = function(value) {
  return jspb.Message.setProto3IntField(this, 2, value);
};


/**
 * optional TargetFieldMetadata target_field_metadata = 3;
 * @return {?proto.emery.agents.TargetFieldMetadata}
 */
proto.emery.agents.FieldMapping.prototype.getTargetFieldMetadata = function() {
  return /** @type{?proto.emery.agents.TargetFieldMetadata} */ (
    jspb.Message.getWrapperField(this, proto.emery.agents.TargetFieldMetadata, 3));
};


/**
 * @param {?proto.emery.agents.TargetFieldMetadata|undefined} value
 * @return {!proto.emery.agents.FieldMapping} returns this
*/
proto.emery.agents.FieldMapping.prototype.setTargetFieldMetadata = function(value) {
  return jspb.Message.setWrapperField(this, 3, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.emery.agents.FieldMapping} returns this
 */
proto.emery.agents.FieldMapping.prototype.clearTargetFieldMetadata = function() {
  return this.setTargetFieldMetadata(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.emery.agents.FieldMapping.prototype.hasTargetFieldMetadata = function() {
  return jspb.Message.getField(this, 3) != null;
};


/**
 * optional bool append_mode = 4;
 * @return {boolean}
 */
proto.emery.agents.FieldMapping.prototype.getAppendMode = function() {
  return /** @type {boolean} */ (jspb.Message.getBooleanFieldWithDefault(this, 4, false));
};


/**
 * @param {boolean} value
 * @return {!proto.emery.agents.FieldMapping} returns this
 */
proto.emery.agents.FieldMapping.prototype.setAppendMode = function(value) {
  return jspb.Message.setProto3BooleanField(this, 4, value);
};



/**
 * List of repeated fields within this message type.
 * @private {!Array<number>}
 * @const
 */
proto.emery.agents.TableMapping.repeatedFields_ = [5];



if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.emery.agents.TableMapping.prototype.toObject = function(opt_includeInstance) {
  return proto.emery.agents.TableMapping.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.emery.agents.TableMapping} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.TableMapping.toObject = function(includeInstance, msg) {
  var f, obj = {
    order: jspb.Message.getFieldWithDefault(msg, 1, 0),
    targetTableId: jspb.Message.getFieldWithDefault(msg, 2, 0),
    rowAction: jspb.Message.getFieldWithDefault(msg, 3, ""),
    rowIdSource: (f = msg.getRowIdSource()) && proto.emery.agents.RowIdSource.toObject(includeInstance, f),
    mappingsList: jspb.Message.toObjectList(msg.getMappingsList(),
    proto.emery.agents.FieldMapping.toObject, includeInstance),
    displayFieldId: jspb.Message.getFieldWithDefault(msg, 6, 0),
    mode: jspb.Message.getFieldWithDefault(msg, 7, "")
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.emery.agents.TableMapping}
 */
proto.emery.agents.TableMapping.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.emery.agents.TableMapping;
  return proto.emery.agents.TableMapping.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.emery.agents.TableMapping} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.emery.agents.TableMapping}
 */
proto.emery.agents.TableMapping.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setOrder(value);
      break;
    case 2:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setTargetTableId(value);
      break;
    case 3:
      var value = /** @type {string} */ (reader.readString());
      msg.setRowAction(value);
      break;
    case 4:
      var value = new proto.emery.agents.RowIdSource;
      reader.readMessage(value,proto.emery.agents.RowIdSource.deserializeBinaryFromReader);
      msg.setRowIdSource(value);
      break;
    case 5:
      var value = new proto.emery.agents.FieldMapping;
      reader.readMessage(value,proto.emery.agents.FieldMapping.deserializeBinaryFromReader);
      msg.addMappings(value);
      break;
    case 6:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setDisplayFieldId(value);
      break;
    case 7:
      var value = /** @type {string} */ (reader.readString());
      msg.setMode(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.emery.agents.TableMapping.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.emery.agents.TableMapping.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.emery.agents.TableMapping} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.TableMapping.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getOrder();
  if (f !== 0) {
    writer.writeInt32(
      1,
      f
    );
  }
  f = message.getTargetTableId();
  if (f !== 0) {
    writer.writeInt32(
      2,
      f
    );
  }
  f = message.getRowAction();
  if (f.length > 0) {
    writer.writeString(
      3,
      f
    );
  }
  f = message.getRowIdSource();
  if (f != null) {
    writer.writeMessage(
      4,
      f,
      proto.emery.agents.RowIdSource.serializeBinaryToWriter
    );
  }
  f = message.getMappingsList();
  if (f.length > 0) {
    writer.writeRepeatedMessage(
      5,
      f,
      proto.emery.agents.FieldMapping.serializeBinaryToWriter
    );
  }
  f = message.getDisplayFieldId();
  if (f !== 0) {
    writer.writeInt32(
      6,
      f
    );
  }
  f = message.getMode();
  if (f.length > 0) {
    writer.writeString(
      7,
      f
    );
  }
};


/**
 * optional int32 order = 1;
 * @return {number}
 */
proto.emery.agents.TableMapping.prototype.getOrder = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 1, 0));
};


/**
 * @param {number} value
 * @return {!proto.emery.agents.TableMapping} returns this
 */
proto.emery.agents.TableMapping.prototype.setOrder = function(value) {
  return jspb.Message.setProto3IntField(this, 1, value);
};


/**
 * optional int32 target_table_id = 2;
 * @return {number}
 */
proto.emery.agents.TableMapping.prototype.getTargetTableId = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 2, 0));
};


/**
 * @param {number} value
 * @return {!proto.emery.agents.TableMapping} returns this
 */
proto.emery.agents.TableMapping.prototype.setTargetTableId = function(value) {
  return jspb.Message.setProto3IntField(this, 2, value);
};


/**
 * optional string row_action = 3;
 * @return {string}
 */
proto.emery.agents.TableMapping.prototype.getRowAction = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 3, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.TableMapping} returns this
 */
proto.emery.agents.TableMapping.prototype.setRowAction = function(value) {
  return jspb.Message.setProto3StringField(this, 3, value);
};


/**
 * optional RowIdSource row_id_source = 4;
 * @return {?proto.emery.agents.RowIdSource}
 */
proto.emery.agents.TableMapping.prototype.getRowIdSource = function() {
  return /** @type{?proto.emery.agents.RowIdSource} */ (
    jspb.Message.getWrapperField(this, proto.emery.agents.RowIdSource, 4));
};


/**
 * @param {?proto.emery.agents.RowIdSource|undefined} value
 * @return {!proto.emery.agents.TableMapping} returns this
*/
proto.emery.agents.TableMapping.prototype.setRowIdSource = function(value) {
  return jspb.Message.setWrapperField(this, 4, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.emery.agents.TableMapping} returns this
 */
proto.emery.agents.TableMapping.prototype.clearRowIdSource = function() {
  return this.setRowIdSource(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.emery.agents.TableMapping.prototype.hasRowIdSource = function() {
  return jspb.Message.getField(this, 4) != null;
};


/**
 * repeated FieldMapping mappings = 5;
 * @return {!Array<!proto.emery.agents.FieldMapping>}
 */
proto.emery.agents.TableMapping.prototype.getMappingsList = function() {
  return /** @type{!Array<!proto.emery.agents.FieldMapping>} */ (
    jspb.Message.getRepeatedWrapperField(this, proto.emery.agents.FieldMapping, 5));
};


/**
 * @param {!Array<!proto.emery.agents.FieldMapping>} value
 * @return {!proto.emery.agents.TableMapping} returns this
*/
proto.emery.agents.TableMapping.prototype.setMappingsList = function(value) {
  return jspb.Message.setRepeatedWrapperField(this, 5, value);
};


/**
 * @param {!proto.emery.agents.FieldMapping=} opt_value
 * @param {number=} opt_index
 * @return {!proto.emery.agents.FieldMapping}
 */
proto.emery.agents.TableMapping.prototype.addMappings = function(opt_value, opt_index) {
  return jspb.Message.addToRepeatedWrapperField(this, 5, opt_value, proto.emery.agents.FieldMapping, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.emery.agents.TableMapping} returns this
 */
proto.emery.agents.TableMapping.prototype.clearMappingsList = function() {
  return this.setMappingsList([]);
};


/**
 * optional int32 display_field_id = 6;
 * @return {number}
 */
proto.emery.agents.TableMapping.prototype.getDisplayFieldId = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 6, 0));
};


/**
 * @param {number} value
 * @return {!proto.emery.agents.TableMapping} returns this
 */
proto.emery.agents.TableMapping.prototype.setDisplayFieldId = function(value) {
  return jspb.Message.setProto3IntField(this, 6, value);
};


/**
 * optional string mode = 7;
 * @return {string}
 */
proto.emery.agents.TableMapping.prototype.getMode = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 7, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.TableMapping} returns this
 */
proto.emery.agents.TableMapping.prototype.setMode = function(value) {
  return jspb.Message.setProto3StringField(this, 7, value);
};



/**
 * List of repeated fields within this message type.
 * @private {!Array<number>}
 * @const
 */
proto.emery.agents.OutputMappingConfig.repeatedFields_ = [2];



if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.emery.agents.OutputMappingConfig.prototype.toObject = function(opt_includeInstance) {
  return proto.emery.agents.OutputMappingConfig.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.emery.agents.OutputMappingConfig} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.OutputMappingConfig.toObject = function(includeInstance, msg) {
  var f, obj = {
    mode: jspb.Message.getFieldWithDefault(msg, 1, ""),
    tableMappingsList: jspb.Message.toObjectList(msg.getTableMappingsList(),
    proto.emery.agents.TableMapping.toObject, includeInstance)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.emery.agents.OutputMappingConfig}
 */
proto.emery.agents.OutputMappingConfig.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.emery.agents.OutputMappingConfig;
  return proto.emery.agents.OutputMappingConfig.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.emery.agents.OutputMappingConfig} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.emery.agents.OutputMappingConfig}
 */
proto.emery.agents.OutputMappingConfig.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setMode(value);
      break;
    case 2:
      var value = new proto.emery.agents.TableMapping;
      reader.readMessage(value,proto.emery.agents.TableMapping.deserializeBinaryFromReader);
      msg.addTableMappings(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.emery.agents.OutputMappingConfig.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.emery.agents.OutputMappingConfig.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.emery.agents.OutputMappingConfig} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.OutputMappingConfig.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getMode();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getTableMappingsList();
  if (f.length > 0) {
    writer.writeRepeatedMessage(
      2,
      f,
      proto.emery.agents.TableMapping.serializeBinaryToWriter
    );
  }
};


/**
 * optional string mode = 1;
 * @return {string}
 */
proto.emery.agents.OutputMappingConfig.prototype.getMode = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.OutputMappingConfig} returns this
 */
proto.emery.agents.OutputMappingConfig.prototype.setMode = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * repeated TableMapping table_mappings = 2;
 * @return {!Array<!proto.emery.agents.TableMapping>}
 */
proto.emery.agents.OutputMappingConfig.prototype.getTableMappingsList = function() {
  return /** @type{!Array<!proto.emery.agents.TableMapping>} */ (
    jspb.Message.getRepeatedWrapperField(this, proto.emery.agents.TableMapping, 2));
};


/**
 * @param {!Array<!proto.emery.agents.TableMapping>} value
 * @return {!proto.emery.agents.OutputMappingConfig} returns this
*/
proto.emery.agents.OutputMappingConfig.prototype.setTableMappingsList = function(value) {
  return jspb.Message.setRepeatedWrapperField(this, 2, value);
};


/**
 * @param {!proto.emery.agents.TableMapping=} opt_value
 * @param {number=} opt_index
 * @return {!proto.emery.agents.TableMapping}
 */
proto.emery.agents.OutputMappingConfig.prototype.addTableMappings = function(opt_value, opt_index) {
  return jspb.Message.addToRepeatedWrapperField(this, 2, opt_value, proto.emery.agents.TableMapping, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.emery.agents.OutputMappingConfig} returns this
 */
proto.emery.agents.OutputMappingConfig.prototype.clearTableMappingsList = function() {
  return this.setTableMappingsList([]);
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.emery.agents.ToolConfig.prototype.toObject = function(opt_includeInstance) {
  return proto.emery.agents.ToolConfig.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.emery.agents.ToolConfig} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.ToolConfig.toObject = function(includeInstance, msg) {
  var f, obj = {
    name: jspb.Message.getFieldWithDefault(msg, 1, ""),
    version: jspb.Message.getFieldWithDefault(msg, 2, ""),
    configMap: (f = msg.getConfigMap()) ? f.toObject(includeInstance, undefined) : []
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.emery.agents.ToolConfig}
 */
proto.emery.agents.ToolConfig.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.emery.agents.ToolConfig;
  return proto.emery.agents.ToolConfig.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.emery.agents.ToolConfig} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.emery.agents.ToolConfig}
 */
proto.emery.agents.ToolConfig.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setName(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setVersion(value);
      break;
    case 3:
      var value = msg.getConfigMap();
      reader.readMessage(value, function(message, reader) {
        jspb.Map.deserializeBinary(message, reader, jspb.BinaryReader.prototype.readString, jspb.BinaryReader.prototype.readString, null, "", "");
         });
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.emery.agents.ToolConfig.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.emery.agents.ToolConfig.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.emery.agents.ToolConfig} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.ToolConfig.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getName();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getVersion();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
  f = message.getConfigMap(true);
  if (f && f.getLength() > 0) {
    f.serializeBinary(3, writer, jspb.BinaryWriter.prototype.writeString, jspb.BinaryWriter.prototype.writeString);
  }
};


/**
 * optional string name = 1;
 * @return {string}
 */
proto.emery.agents.ToolConfig.prototype.getName = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.ToolConfig} returns this
 */
proto.emery.agents.ToolConfig.prototype.setName = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional string version = 2;
 * @return {string}
 */
proto.emery.agents.ToolConfig.prototype.getVersion = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.ToolConfig} returns this
 */
proto.emery.agents.ToolConfig.prototype.setVersion = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};


/**
 * map<string, string> config = 3;
 * @param {boolean=} opt_noLazyCreate Do not create the map if
 * empty, instead returning `undefined`
 * @return {!jspb.Map<string,string>}
 */
proto.emery.agents.ToolConfig.prototype.getConfigMap = function(opt_noLazyCreate) {
  return /** @type {!jspb.Map<string,string>} */ (
      jspb.Message.getMapField(this, 3, opt_noLazyCreate,
      null));
};


/**
 * Clears values from the map. The map will be non-null.
 * @return {!proto.emery.agents.ToolConfig} returns this
 */
proto.emery.agents.ToolConfig.prototype.clearConfigMap = function() {
  this.getConfigMap().clear();
  return this;};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.emery.agents.ServerConfig.prototype.toObject = function(opt_includeInstance) {
  return proto.emery.agents.ServerConfig.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.emery.agents.ServerConfig} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.ServerConfig.toObject = function(includeInstance, msg) {
  var f, obj = {
    name: jspb.Message.getFieldWithDefault(msg, 1, ""),
    endpoint: jspb.Message.getFieldWithDefault(msg, 2, ""),
    configMap: (f = msg.getConfigMap()) ? f.toObject(includeInstance, undefined) : []
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.emery.agents.ServerConfig}
 */
proto.emery.agents.ServerConfig.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.emery.agents.ServerConfig;
  return proto.emery.agents.ServerConfig.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.emery.agents.ServerConfig} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.emery.agents.ServerConfig}
 */
proto.emery.agents.ServerConfig.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setName(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setEndpoint(value);
      break;
    case 3:
      var value = msg.getConfigMap();
      reader.readMessage(value, function(message, reader) {
        jspb.Map.deserializeBinary(message, reader, jspb.BinaryReader.prototype.readString, jspb.BinaryReader.prototype.readString, null, "", "");
         });
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.emery.agents.ServerConfig.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.emery.agents.ServerConfig.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.emery.agents.ServerConfig} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.ServerConfig.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getName();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getEndpoint();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
  f = message.getConfigMap(true);
  if (f && f.getLength() > 0) {
    f.serializeBinary(3, writer, jspb.BinaryWriter.prototype.writeString, jspb.BinaryWriter.prototype.writeString);
  }
};


/**
 * optional string name = 1;
 * @return {string}
 */
proto.emery.agents.ServerConfig.prototype.getName = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.ServerConfig} returns this
 */
proto.emery.agents.ServerConfig.prototype.setName = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional string endpoint = 2;
 * @return {string}
 */
proto.emery.agents.ServerConfig.prototype.getEndpoint = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.ServerConfig} returns this
 */
proto.emery.agents.ServerConfig.prototype.setEndpoint = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};


/**
 * map<string, string> config = 3;
 * @param {boolean=} opt_noLazyCreate Do not create the map if
 * empty, instead returning `undefined`
 * @return {!jspb.Map<string,string>}
 */
proto.emery.agents.ServerConfig.prototype.getConfigMap = function(opt_noLazyCreate) {
  return /** @type {!jspb.Map<string,string>} */ (
      jspb.Message.getMapField(this, 3, opt_noLazyCreate,
      null));
};


/**
 * Clears values from the map. The map will be non-null.
 * @return {!proto.emery.agents.ServerConfig} returns this
 */
proto.emery.agents.ServerConfig.prototype.clearConfigMap = function() {
  this.getConfigMap().clear();
  return this;};



/**
 * Oneof group definitions for this message. Each group defines the field
 * numbers belonging to that group. When of these fields' value is set, all
 * other fields in the group are cleared. During deserialization, if multiple
 * fields are encountered for a group, only the last value seen will be kept.
 * @private {!Array<!Array<number>>}
 * @const
 */
proto.emery.agents.SkillInputValue.oneofGroups_ = [[3,4,5,6]];

/**
 * @enum {number}
 */
proto.emery.agents.SkillInputValue.ValueCase = {
  VALUE_NOT_SET: 0,
  STRING_VALUE: 3,
  NUMBER_VALUE: 4,
  BOOL_VALUE: 5,
  JSON_VALUE: 6
};

/**
 * @return {proto.emery.agents.SkillInputValue.ValueCase}
 */
proto.emery.agents.SkillInputValue.prototype.getValueCase = function() {
  return /** @type {proto.emery.agents.SkillInputValue.ValueCase} */(jspb.Message.computeOneofCase(this, proto.emery.agents.SkillInputValue.oneofGroups_[0]));
};



if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.emery.agents.SkillInputValue.prototype.toObject = function(opt_includeInstance) {
  return proto.emery.agents.SkillInputValue.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.emery.agents.SkillInputValue} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.SkillInputValue.toObject = function(includeInstance, msg) {
  var f, obj = {
    name: jspb.Message.getFieldWithDefault(msg, 1, ""),
    type: jspb.Message.getFieldWithDefault(msg, 2, ""),
    stringValue: jspb.Message.getFieldWithDefault(msg, 3, ""),
    numberValue: jspb.Message.getFloatingPointFieldWithDefault(msg, 4, 0.0),
    boolValue: jspb.Message.getBooleanFieldWithDefault(msg, 5, false),
    jsonValue: jspb.Message.getFieldWithDefault(msg, 6, "")
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.emery.agents.SkillInputValue}
 */
proto.emery.agents.SkillInputValue.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.emery.agents.SkillInputValue;
  return proto.emery.agents.SkillInputValue.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.emery.agents.SkillInputValue} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.emery.agents.SkillInputValue}
 */
proto.emery.agents.SkillInputValue.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setName(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setType(value);
      break;
    case 3:
      var value = /** @type {string} */ (reader.readString());
      msg.setStringValue(value);
      break;
    case 4:
      var value = /** @type {number} */ (reader.readDouble());
      msg.setNumberValue(value);
      break;
    case 5:
      var value = /** @type {boolean} */ (reader.readBool());
      msg.setBoolValue(value);
      break;
    case 6:
      var value = /** @type {string} */ (reader.readString());
      msg.setJsonValue(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.emery.agents.SkillInputValue.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.emery.agents.SkillInputValue.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.emery.agents.SkillInputValue} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.SkillInputValue.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getName();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getType();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
  f = /** @type {string} */ (jspb.Message.getField(message, 3));
  if (f != null) {
    writer.writeString(
      3,
      f
    );
  }
  f = /** @type {number} */ (jspb.Message.getField(message, 4));
  if (f != null) {
    writer.writeDouble(
      4,
      f
    );
  }
  f = /** @type {boolean} */ (jspb.Message.getField(message, 5));
  if (f != null) {
    writer.writeBool(
      5,
      f
    );
  }
  f = /** @type {string} */ (jspb.Message.getField(message, 6));
  if (f != null) {
    writer.writeString(
      6,
      f
    );
  }
};


/**
 * optional string name = 1;
 * @return {string}
 */
proto.emery.agents.SkillInputValue.prototype.getName = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.SkillInputValue} returns this
 */
proto.emery.agents.SkillInputValue.prototype.setName = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional string type = 2;
 * @return {string}
 */
proto.emery.agents.SkillInputValue.prototype.getType = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.SkillInputValue} returns this
 */
proto.emery.agents.SkillInputValue.prototype.setType = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};


/**
 * optional string string_value = 3;
 * @return {string}
 */
proto.emery.agents.SkillInputValue.prototype.getStringValue = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 3, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.SkillInputValue} returns this
 */
proto.emery.agents.SkillInputValue.prototype.setStringValue = function(value) {
  return jspb.Message.setOneofField(this, 3, proto.emery.agents.SkillInputValue.oneofGroups_[0], value);
};


/**
 * Clears the field making it undefined.
 * @return {!proto.emery.agents.SkillInputValue} returns this
 */
proto.emery.agents.SkillInputValue.prototype.clearStringValue = function() {
  return jspb.Message.setOneofField(this, 3, proto.emery.agents.SkillInputValue.oneofGroups_[0], undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.emery.agents.SkillInputValue.prototype.hasStringValue = function() {
  return jspb.Message.getField(this, 3) != null;
};


/**
 * optional double number_value = 4;
 * @return {number}
 */
proto.emery.agents.SkillInputValue.prototype.getNumberValue = function() {
  return /** @type {number} */ (jspb.Message.getFloatingPointFieldWithDefault(this, 4, 0.0));
};


/**
 * @param {number} value
 * @return {!proto.emery.agents.SkillInputValue} returns this
 */
proto.emery.agents.SkillInputValue.prototype.setNumberValue = function(value) {
  return jspb.Message.setOneofField(this, 4, proto.emery.agents.SkillInputValue.oneofGroups_[0], value);
};


/**
 * Clears the field making it undefined.
 * @return {!proto.emery.agents.SkillInputValue} returns this
 */
proto.emery.agents.SkillInputValue.prototype.clearNumberValue = function() {
  return jspb.Message.setOneofField(this, 4, proto.emery.agents.SkillInputValue.oneofGroups_[0], undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.emery.agents.SkillInputValue.prototype.hasNumberValue = function() {
  return jspb.Message.getField(this, 4) != null;
};


/**
 * optional bool bool_value = 5;
 * @return {boolean}
 */
proto.emery.agents.SkillInputValue.prototype.getBoolValue = function() {
  return /** @type {boolean} */ (jspb.Message.getBooleanFieldWithDefault(this, 5, false));
};


/**
 * @param {boolean} value
 * @return {!proto.emery.agents.SkillInputValue} returns this
 */
proto.emery.agents.SkillInputValue.prototype.setBoolValue = function(value) {
  return jspb.Message.setOneofField(this, 5, proto.emery.agents.SkillInputValue.oneofGroups_[0], value);
};


/**
 * Clears the field making it undefined.
 * @return {!proto.emery.agents.SkillInputValue} returns this
 */
proto.emery.agents.SkillInputValue.prototype.clearBoolValue = function() {
  return jspb.Message.setOneofField(this, 5, proto.emery.agents.SkillInputValue.oneofGroups_[0], undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.emery.agents.SkillInputValue.prototype.hasBoolValue = function() {
  return jspb.Message.getField(this, 5) != null;
};


/**
 * optional string json_value = 6;
 * @return {string}
 */
proto.emery.agents.SkillInputValue.prototype.getJsonValue = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 6, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.SkillInputValue} returns this
 */
proto.emery.agents.SkillInputValue.prototype.setJsonValue = function(value) {
  return jspb.Message.setOneofField(this, 6, proto.emery.agents.SkillInputValue.oneofGroups_[0], value);
};


/**
 * Clears the field making it undefined.
 * @return {!proto.emery.agents.SkillInputValue} returns this
 */
proto.emery.agents.SkillInputValue.prototype.clearJsonValue = function() {
  return jspb.Message.setOneofField(this, 6, proto.emery.agents.SkillInputValue.oneofGroups_[0], undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.emery.agents.SkillInputValue.prototype.hasJsonValue = function() {
  return jspb.Message.getField(this, 6) != null;
};



/**
 * List of repeated fields within this message type.
 * @private {!Array<number>}
 * @const
 */
proto.emery.agents.TriggerData.repeatedFields_ = [1];



if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.emery.agents.TriggerData.prototype.toObject = function(opt_includeInstance) {
  return proto.emery.agents.TriggerData.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.emery.agents.TriggerData} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.TriggerData.toObject = function(includeInstance, msg) {
  var f, obj = {
    skillInputsList: jspb.Message.toObjectList(msg.getSkillInputsList(),
    proto.emery.agents.SkillInputValue.toObject, includeInstance)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.emery.agents.TriggerData}
 */
proto.emery.agents.TriggerData.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.emery.agents.TriggerData;
  return proto.emery.agents.TriggerData.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.emery.agents.TriggerData} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.emery.agents.TriggerData}
 */
proto.emery.agents.TriggerData.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = new proto.emery.agents.SkillInputValue;
      reader.readMessage(value,proto.emery.agents.SkillInputValue.deserializeBinaryFromReader);
      msg.addSkillInputs(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.emery.agents.TriggerData.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.emery.agents.TriggerData.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.emery.agents.TriggerData} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.TriggerData.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getSkillInputsList();
  if (f.length > 0) {
    writer.writeRepeatedMessage(
      1,
      f,
      proto.emery.agents.SkillInputValue.serializeBinaryToWriter
    );
  }
};


/**
 * repeated SkillInputValue skill_inputs = 1;
 * @return {!Array<!proto.emery.agents.SkillInputValue>}
 */
proto.emery.agents.TriggerData.prototype.getSkillInputsList = function() {
  return /** @type{!Array<!proto.emery.agents.SkillInputValue>} */ (
    jspb.Message.getRepeatedWrapperField(this, proto.emery.agents.SkillInputValue, 1));
};


/**
 * @param {!Array<!proto.emery.agents.SkillInputValue>} value
 * @return {!proto.emery.agents.TriggerData} returns this
*/
proto.emery.agents.TriggerData.prototype.setSkillInputsList = function(value) {
  return jspb.Message.setRepeatedWrapperField(this, 1, value);
};


/**
 * @param {!proto.emery.agents.SkillInputValue=} opt_value
 * @param {number=} opt_index
 * @return {!proto.emery.agents.SkillInputValue}
 */
proto.emery.agents.TriggerData.prototype.addSkillInputs = function(opt_value, opt_index) {
  return jspb.Message.addToRepeatedWrapperField(this, 1, opt_value, proto.emery.agents.SkillInputValue, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.emery.agents.TriggerData} returns this
 */
proto.emery.agents.TriggerData.prototype.clearSkillInputsList = function() {
  return this.setSkillInputsList([]);
};



/**
 * List of repeated fields within this message type.
 * @private {!Array<number>}
 * @const
 */
proto.emery.agents.InstructionConfig.repeatedFields_ = [2,3,4,5];



if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.emery.agents.InstructionConfig.prototype.toObject = function(opt_includeInstance) {
  return proto.emery.agents.InstructionConfig.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.emery.agents.InstructionConfig} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.InstructionConfig.toObject = function(includeInstance, msg) {
  var f, obj = {
    task: jspb.Message.getFieldWithDefault(msg, 1, ""),
    imagesList: jspb.Message.toObjectList(msg.getImagesList(),
    proto.emery.agents.ImageAttachment.toObject, includeInstance),
    attachmentsList: jspb.Message.toObjectList(msg.getAttachmentsList(),
    proto.emery.agents.FileAttachment.toObject, includeInstance),
    toolsList: jspb.Message.toObjectList(msg.getToolsList(),
    proto.emery.agents.ToolConfig.toObject, includeInstance),
    serversList: jspb.Message.toObjectList(msg.getServersList(),
    proto.emery.agents.ServerConfig.toObject, includeInstance),
    model: jspb.Message.getFieldWithDefault(msg, 6, "")
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.emery.agents.InstructionConfig}
 */
proto.emery.agents.InstructionConfig.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.emery.agents.InstructionConfig;
  return proto.emery.agents.InstructionConfig.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.emery.agents.InstructionConfig} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.emery.agents.InstructionConfig}
 */
proto.emery.agents.InstructionConfig.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setTask(value);
      break;
    case 2:
      var value = new proto.emery.agents.ImageAttachment;
      reader.readMessage(value,proto.emery.agents.ImageAttachment.deserializeBinaryFromReader);
      msg.addImages(value);
      break;
    case 3:
      var value = new proto.emery.agents.FileAttachment;
      reader.readMessage(value,proto.emery.agents.FileAttachment.deserializeBinaryFromReader);
      msg.addAttachments(value);
      break;
    case 4:
      var value = new proto.emery.agents.ToolConfig;
      reader.readMessage(value,proto.emery.agents.ToolConfig.deserializeBinaryFromReader);
      msg.addTools(value);
      break;
    case 5:
      var value = new proto.emery.agents.ServerConfig;
      reader.readMessage(value,proto.emery.agents.ServerConfig.deserializeBinaryFromReader);
      msg.addServers(value);
      break;
    case 6:
      var value = /** @type {string} */ (reader.readString());
      msg.setModel(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.emery.agents.InstructionConfig.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.emery.agents.InstructionConfig.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.emery.agents.InstructionConfig} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.InstructionConfig.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getTask();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getImagesList();
  if (f.length > 0) {
    writer.writeRepeatedMessage(
      2,
      f,
      proto.emery.agents.ImageAttachment.serializeBinaryToWriter
    );
  }
  f = message.getAttachmentsList();
  if (f.length > 0) {
    writer.writeRepeatedMessage(
      3,
      f,
      proto.emery.agents.FileAttachment.serializeBinaryToWriter
    );
  }
  f = message.getToolsList();
  if (f.length > 0) {
    writer.writeRepeatedMessage(
      4,
      f,
      proto.emery.agents.ToolConfig.serializeBinaryToWriter
    );
  }
  f = message.getServersList();
  if (f.length > 0) {
    writer.writeRepeatedMessage(
      5,
      f,
      proto.emery.agents.ServerConfig.serializeBinaryToWriter
    );
  }
  f = message.getModel();
  if (f.length > 0) {
    writer.writeString(
      6,
      f
    );
  }
};


/**
 * optional string task = 1;
 * @return {string}
 */
proto.emery.agents.InstructionConfig.prototype.getTask = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.InstructionConfig} returns this
 */
proto.emery.agents.InstructionConfig.prototype.setTask = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * repeated ImageAttachment images = 2;
 * @return {!Array<!proto.emery.agents.ImageAttachment>}
 */
proto.emery.agents.InstructionConfig.prototype.getImagesList = function() {
  return /** @type{!Array<!proto.emery.agents.ImageAttachment>} */ (
    jspb.Message.getRepeatedWrapperField(this, proto.emery.agents.ImageAttachment, 2));
};


/**
 * @param {!Array<!proto.emery.agents.ImageAttachment>} value
 * @return {!proto.emery.agents.InstructionConfig} returns this
*/
proto.emery.agents.InstructionConfig.prototype.setImagesList = function(value) {
  return jspb.Message.setRepeatedWrapperField(this, 2, value);
};


/**
 * @param {!proto.emery.agents.ImageAttachment=} opt_value
 * @param {number=} opt_index
 * @return {!proto.emery.agents.ImageAttachment}
 */
proto.emery.agents.InstructionConfig.prototype.addImages = function(opt_value, opt_index) {
  return jspb.Message.addToRepeatedWrapperField(this, 2, opt_value, proto.emery.agents.ImageAttachment, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.emery.agents.InstructionConfig} returns this
 */
proto.emery.agents.InstructionConfig.prototype.clearImagesList = function() {
  return this.setImagesList([]);
};


/**
 * repeated FileAttachment attachments = 3;
 * @return {!Array<!proto.emery.agents.FileAttachment>}
 */
proto.emery.agents.InstructionConfig.prototype.getAttachmentsList = function() {
  return /** @type{!Array<!proto.emery.agents.FileAttachment>} */ (
    jspb.Message.getRepeatedWrapperField(this, proto.emery.agents.FileAttachment, 3));
};


/**
 * @param {!Array<!proto.emery.agents.FileAttachment>} value
 * @return {!proto.emery.agents.InstructionConfig} returns this
*/
proto.emery.agents.InstructionConfig.prototype.setAttachmentsList = function(value) {
  return jspb.Message.setRepeatedWrapperField(this, 3, value);
};


/**
 * @param {!proto.emery.agents.FileAttachment=} opt_value
 * @param {number=} opt_index
 * @return {!proto.emery.agents.FileAttachment}
 */
proto.emery.agents.InstructionConfig.prototype.addAttachments = function(opt_value, opt_index) {
  return jspb.Message.addToRepeatedWrapperField(this, 3, opt_value, proto.emery.agents.FileAttachment, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.emery.agents.InstructionConfig} returns this
 */
proto.emery.agents.InstructionConfig.prototype.clearAttachmentsList = function() {
  return this.setAttachmentsList([]);
};


/**
 * repeated ToolConfig tools = 4;
 * @return {!Array<!proto.emery.agents.ToolConfig>}
 */
proto.emery.agents.InstructionConfig.prototype.getToolsList = function() {
  return /** @type{!Array<!proto.emery.agents.ToolConfig>} */ (
    jspb.Message.getRepeatedWrapperField(this, proto.emery.agents.ToolConfig, 4));
};


/**
 * @param {!Array<!proto.emery.agents.ToolConfig>} value
 * @return {!proto.emery.agents.InstructionConfig} returns this
*/
proto.emery.agents.InstructionConfig.prototype.setToolsList = function(value) {
  return jspb.Message.setRepeatedWrapperField(this, 4, value);
};


/**
 * @param {!proto.emery.agents.ToolConfig=} opt_value
 * @param {number=} opt_index
 * @return {!proto.emery.agents.ToolConfig}
 */
proto.emery.agents.InstructionConfig.prototype.addTools = function(opt_value, opt_index) {
  return jspb.Message.addToRepeatedWrapperField(this, 4, opt_value, proto.emery.agents.ToolConfig, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.emery.agents.InstructionConfig} returns this
 */
proto.emery.agents.InstructionConfig.prototype.clearToolsList = function() {
  return this.setToolsList([]);
};


/**
 * repeated ServerConfig servers = 5;
 * @return {!Array<!proto.emery.agents.ServerConfig>}
 */
proto.emery.agents.InstructionConfig.prototype.getServersList = function() {
  return /** @type{!Array<!proto.emery.agents.ServerConfig>} */ (
    jspb.Message.getRepeatedWrapperField(this, proto.emery.agents.ServerConfig, 5));
};


/**
 * @param {!Array<!proto.emery.agents.ServerConfig>} value
 * @return {!proto.emery.agents.InstructionConfig} returns this
*/
proto.emery.agents.InstructionConfig.prototype.setServersList = function(value) {
  return jspb.Message.setRepeatedWrapperField(this, 5, value);
};


/**
 * @param {!proto.emery.agents.ServerConfig=} opt_value
 * @param {number=} opt_index
 * @return {!proto.emery.agents.ServerConfig}
 */
proto.emery.agents.InstructionConfig.prototype.addServers = function(opt_value, opt_index) {
  return jspb.Message.addToRepeatedWrapperField(this, 5, opt_value, proto.emery.agents.ServerConfig, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.emery.agents.InstructionConfig} returns this
 */
proto.emery.agents.InstructionConfig.prototype.clearServersList = function() {
  return this.setServersList([]);
};


/**
 * optional string model = 6;
 * @return {string}
 */
proto.emery.agents.InstructionConfig.prototype.getModel = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 6, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.InstructionConfig} returns this
 */
proto.emery.agents.InstructionConfig.prototype.setModel = function(value) {
  return jspb.Message.setProto3StringField(this, 6, value);
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.emery.agents.ImageAttachment.prototype.toObject = function(opt_includeInstance) {
  return proto.emery.agents.ImageAttachment.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.emery.agents.ImageAttachment} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.ImageAttachment.toObject = function(includeInstance, msg) {
  var f, obj = {
    url: jspb.Message.getFieldWithDefault(msg, 1, ""),
    s3Key: jspb.Message.getFieldWithDefault(msg, 2, "")
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.emery.agents.ImageAttachment}
 */
proto.emery.agents.ImageAttachment.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.emery.agents.ImageAttachment;
  return proto.emery.agents.ImageAttachment.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.emery.agents.ImageAttachment} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.emery.agents.ImageAttachment}
 */
proto.emery.agents.ImageAttachment.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setUrl(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setS3Key(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.emery.agents.ImageAttachment.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.emery.agents.ImageAttachment.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.emery.agents.ImageAttachment} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.ImageAttachment.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getUrl();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getS3Key();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
};


/**
 * optional string url = 1;
 * @return {string}
 */
proto.emery.agents.ImageAttachment.prototype.getUrl = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.ImageAttachment} returns this
 */
proto.emery.agents.ImageAttachment.prototype.setUrl = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional string s3_key = 2;
 * @return {string}
 */
proto.emery.agents.ImageAttachment.prototype.getS3Key = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.ImageAttachment} returns this
 */
proto.emery.agents.ImageAttachment.prototype.setS3Key = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.emery.agents.FileAttachment.prototype.toObject = function(opt_includeInstance) {
  return proto.emery.agents.FileAttachment.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.emery.agents.FileAttachment} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.FileAttachment.toObject = function(includeInstance, msg) {
  var f, obj = {
    type: jspb.Message.getFieldWithDefault(msg, 1, ""),
    url: jspb.Message.getFieldWithDefault(msg, 2, ""),
    filename: jspb.Message.getFieldWithDefault(msg, 3, ""),
    mimeType: jspb.Message.getFieldWithDefault(msg, 4, "")
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.emery.agents.FileAttachment}
 */
proto.emery.agents.FileAttachment.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.emery.agents.FileAttachment;
  return proto.emery.agents.FileAttachment.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.emery.agents.FileAttachment} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.emery.agents.FileAttachment}
 */
proto.emery.agents.FileAttachment.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setType(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setUrl(value);
      break;
    case 3:
      var value = /** @type {string} */ (reader.readString());
      msg.setFilename(value);
      break;
    case 4:
      var value = /** @type {string} */ (reader.readString());
      msg.setMimeType(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.emery.agents.FileAttachment.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.emery.agents.FileAttachment.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.emery.agents.FileAttachment} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.FileAttachment.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getType();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getUrl();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
  f = message.getFilename();
  if (f.length > 0) {
    writer.writeString(
      3,
      f
    );
  }
  f = message.getMimeType();
  if (f.length > 0) {
    writer.writeString(
      4,
      f
    );
  }
};


/**
 * optional string type = 1;
 * @return {string}
 */
proto.emery.agents.FileAttachment.prototype.getType = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.FileAttachment} returns this
 */
proto.emery.agents.FileAttachment.prototype.setType = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional string url = 2;
 * @return {string}
 */
proto.emery.agents.FileAttachment.prototype.getUrl = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.FileAttachment} returns this
 */
proto.emery.agents.FileAttachment.prototype.setUrl = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};


/**
 * optional string filename = 3;
 * @return {string}
 */
proto.emery.agents.FileAttachment.prototype.getFilename = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 3, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.FileAttachment} returns this
 */
proto.emery.agents.FileAttachment.prototype.setFilename = function(value) {
  return jspb.Message.setProto3StringField(this, 3, value);
};


/**
 * optional string mime_type = 4;
 * @return {string}
 */
proto.emery.agents.FileAttachment.prototype.getMimeType = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 4, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.FileAttachment} returns this
 */
proto.emery.agents.FileAttachment.prototype.setMimeType = function(value) {
  return jspb.Message.setProto3StringField(this, 4, value);
};



/**
 * List of repeated fields within this message type.
 * @private {!Array<number>}
 * @const
 */
proto.emery.agents.ProcessMessageRequest.repeatedFields_ = [1,5];



if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.emery.agents.ProcessMessageRequest.prototype.toObject = function(opt_includeInstance) {
  return proto.emery.agents.ProcessMessageRequest.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.emery.agents.ProcessMessageRequest} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.ProcessMessageRequest.toObject = function(includeInstance, msg) {
  var f, obj = {
    messagePartsList: jspb.Message.toObjectList(msg.getMessagePartsList(),
    proto.emery.agents.MessagePart.toObject, includeInstance),
    userId: jspb.Message.getFieldWithDefault(msg, 2, ""),
    organizationId: jspb.Message.getFieldWithDefault(msg, 3, 0),
    context: (f = msg.getContext()) && proto.emery.agents.ChatContext.toObject(includeInstance, f),
    conversationHistoryList: jspb.Message.toObjectList(msg.getConversationHistoryList(),
    proto.emery.agents.HistoryMessage.toObject, includeInstance),
    agentConfig: (f = msg.getAgentConfig()) && proto.emery.agents.AgentConfig.toObject(includeInstance, f),
    model: jspb.Message.getFieldWithDefault(msg, 7, ""),
    messageId: jspb.Message.getFieldWithDefault(msg, 8, ""),
    sessionId: jspb.Message.getFieldWithDefault(msg, 9, ""),
    userApiKey: jspb.Message.getFieldWithDefault(msg, 10, "")
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.emery.agents.ProcessMessageRequest}
 */
proto.emery.agents.ProcessMessageRequest.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.emery.agents.ProcessMessageRequest;
  return proto.emery.agents.ProcessMessageRequest.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.emery.agents.ProcessMessageRequest} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.emery.agents.ProcessMessageRequest}
 */
proto.emery.agents.ProcessMessageRequest.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = new proto.emery.agents.MessagePart;
      reader.readMessage(value,proto.emery.agents.MessagePart.deserializeBinaryFromReader);
      msg.addMessageParts(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setUserId(value);
      break;
    case 3:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setOrganizationId(value);
      break;
    case 4:
      var value = new proto.emery.agents.ChatContext;
      reader.readMessage(value,proto.emery.agents.ChatContext.deserializeBinaryFromReader);
      msg.setContext(value);
      break;
    case 5:
      var value = new proto.emery.agents.HistoryMessage;
      reader.readMessage(value,proto.emery.agents.HistoryMessage.deserializeBinaryFromReader);
      msg.addConversationHistory(value);
      break;
    case 6:
      var value = new proto.emery.agents.AgentConfig;
      reader.readMessage(value,proto.emery.agents.AgentConfig.deserializeBinaryFromReader);
      msg.setAgentConfig(value);
      break;
    case 7:
      var value = /** @type {string} */ (reader.readString());
      msg.setModel(value);
      break;
    case 8:
      var value = /** @type {string} */ (reader.readString());
      msg.setMessageId(value);
      break;
    case 9:
      var value = /** @type {string} */ (reader.readString());
      msg.setSessionId(value);
      break;
    case 10:
      var value = /** @type {string} */ (reader.readString());
      msg.setUserApiKey(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.emery.agents.ProcessMessageRequest.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.emery.agents.ProcessMessageRequest.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.emery.agents.ProcessMessageRequest} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.ProcessMessageRequest.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getMessagePartsList();
  if (f.length > 0) {
    writer.writeRepeatedMessage(
      1,
      f,
      proto.emery.agents.MessagePart.serializeBinaryToWriter
    );
  }
  f = message.getUserId();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
  f = message.getOrganizationId();
  if (f !== 0) {
    writer.writeInt32(
      3,
      f
    );
  }
  f = message.getContext();
  if (f != null) {
    writer.writeMessage(
      4,
      f,
      proto.emery.agents.ChatContext.serializeBinaryToWriter
    );
  }
  f = message.getConversationHistoryList();
  if (f.length > 0) {
    writer.writeRepeatedMessage(
      5,
      f,
      proto.emery.agents.HistoryMessage.serializeBinaryToWriter
    );
  }
  f = message.getAgentConfig();
  if (f != null) {
    writer.writeMessage(
      6,
      f,
      proto.emery.agents.AgentConfig.serializeBinaryToWriter
    );
  }
  f = message.getModel();
  if (f.length > 0) {
    writer.writeString(
      7,
      f
    );
  }
  f = message.getMessageId();
  if (f.length > 0) {
    writer.writeString(
      8,
      f
    );
  }
  f = message.getSessionId();
  if (f.length > 0) {
    writer.writeString(
      9,
      f
    );
  }
  f = message.getUserApiKey();
  if (f.length > 0) {
    writer.writeString(
      10,
      f
    );
  }
};


/**
 * repeated MessagePart message_parts = 1;
 * @return {!Array<!proto.emery.agents.MessagePart>}
 */
proto.emery.agents.ProcessMessageRequest.prototype.getMessagePartsList = function() {
  return /** @type{!Array<!proto.emery.agents.MessagePart>} */ (
    jspb.Message.getRepeatedWrapperField(this, proto.emery.agents.MessagePart, 1));
};


/**
 * @param {!Array<!proto.emery.agents.MessagePart>} value
 * @return {!proto.emery.agents.ProcessMessageRequest} returns this
*/
proto.emery.agents.ProcessMessageRequest.prototype.setMessagePartsList = function(value) {
  return jspb.Message.setRepeatedWrapperField(this, 1, value);
};


/**
 * @param {!proto.emery.agents.MessagePart=} opt_value
 * @param {number=} opt_index
 * @return {!proto.emery.agents.MessagePart}
 */
proto.emery.agents.ProcessMessageRequest.prototype.addMessageParts = function(opt_value, opt_index) {
  return jspb.Message.addToRepeatedWrapperField(this, 1, opt_value, proto.emery.agents.MessagePart, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.emery.agents.ProcessMessageRequest} returns this
 */
proto.emery.agents.ProcessMessageRequest.prototype.clearMessagePartsList = function() {
  return this.setMessagePartsList([]);
};


/**
 * optional string user_id = 2;
 * @return {string}
 */
proto.emery.agents.ProcessMessageRequest.prototype.getUserId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.ProcessMessageRequest} returns this
 */
proto.emery.agents.ProcessMessageRequest.prototype.setUserId = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};


/**
 * optional int32 organization_id = 3;
 * @return {number}
 */
proto.emery.agents.ProcessMessageRequest.prototype.getOrganizationId = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 3, 0));
};


/**
 * @param {number} value
 * @return {!proto.emery.agents.ProcessMessageRequest} returns this
 */
proto.emery.agents.ProcessMessageRequest.prototype.setOrganizationId = function(value) {
  return jspb.Message.setProto3IntField(this, 3, value);
};


/**
 * optional ChatContext context = 4;
 * @return {?proto.emery.agents.ChatContext}
 */
proto.emery.agents.ProcessMessageRequest.prototype.getContext = function() {
  return /** @type{?proto.emery.agents.ChatContext} */ (
    jspb.Message.getWrapperField(this, proto.emery.agents.ChatContext, 4));
};


/**
 * @param {?proto.emery.agents.ChatContext|undefined} value
 * @return {!proto.emery.agents.ProcessMessageRequest} returns this
*/
proto.emery.agents.ProcessMessageRequest.prototype.setContext = function(value) {
  return jspb.Message.setWrapperField(this, 4, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.emery.agents.ProcessMessageRequest} returns this
 */
proto.emery.agents.ProcessMessageRequest.prototype.clearContext = function() {
  return this.setContext(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.emery.agents.ProcessMessageRequest.prototype.hasContext = function() {
  return jspb.Message.getField(this, 4) != null;
};


/**
 * repeated HistoryMessage conversation_history = 5;
 * @return {!Array<!proto.emery.agents.HistoryMessage>}
 */
proto.emery.agents.ProcessMessageRequest.prototype.getConversationHistoryList = function() {
  return /** @type{!Array<!proto.emery.agents.HistoryMessage>} */ (
    jspb.Message.getRepeatedWrapperField(this, proto.emery.agents.HistoryMessage, 5));
};


/**
 * @param {!Array<!proto.emery.agents.HistoryMessage>} value
 * @return {!proto.emery.agents.ProcessMessageRequest} returns this
*/
proto.emery.agents.ProcessMessageRequest.prototype.setConversationHistoryList = function(value) {
  return jspb.Message.setRepeatedWrapperField(this, 5, value);
};


/**
 * @param {!proto.emery.agents.HistoryMessage=} opt_value
 * @param {number=} opt_index
 * @return {!proto.emery.agents.HistoryMessage}
 */
proto.emery.agents.ProcessMessageRequest.prototype.addConversationHistory = function(opt_value, opt_index) {
  return jspb.Message.addToRepeatedWrapperField(this, 5, opt_value, proto.emery.agents.HistoryMessage, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.emery.agents.ProcessMessageRequest} returns this
 */
proto.emery.agents.ProcessMessageRequest.prototype.clearConversationHistoryList = function() {
  return this.setConversationHistoryList([]);
};


/**
 * optional AgentConfig agent_config = 6;
 * @return {?proto.emery.agents.AgentConfig}
 */
proto.emery.agents.ProcessMessageRequest.prototype.getAgentConfig = function() {
  return /** @type{?proto.emery.agents.AgentConfig} */ (
    jspb.Message.getWrapperField(this, proto.emery.agents.AgentConfig, 6));
};


/**
 * @param {?proto.emery.agents.AgentConfig|undefined} value
 * @return {!proto.emery.agents.ProcessMessageRequest} returns this
*/
proto.emery.agents.ProcessMessageRequest.prototype.setAgentConfig = function(value) {
  return jspb.Message.setWrapperField(this, 6, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.emery.agents.ProcessMessageRequest} returns this
 */
proto.emery.agents.ProcessMessageRequest.prototype.clearAgentConfig = function() {
  return this.setAgentConfig(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.emery.agents.ProcessMessageRequest.prototype.hasAgentConfig = function() {
  return jspb.Message.getField(this, 6) != null;
};


/**
 * optional string model = 7;
 * @return {string}
 */
proto.emery.agents.ProcessMessageRequest.prototype.getModel = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 7, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.ProcessMessageRequest} returns this
 */
proto.emery.agents.ProcessMessageRequest.prototype.setModel = function(value) {
  return jspb.Message.setProto3StringField(this, 7, value);
};


/**
 * optional string message_id = 8;
 * @return {string}
 */
proto.emery.agents.ProcessMessageRequest.prototype.getMessageId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 8, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.ProcessMessageRequest} returns this
 */
proto.emery.agents.ProcessMessageRequest.prototype.setMessageId = function(value) {
  return jspb.Message.setProto3StringField(this, 8, value);
};


/**
 * optional string session_id = 9;
 * @return {string}
 */
proto.emery.agents.ProcessMessageRequest.prototype.getSessionId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 9, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.ProcessMessageRequest} returns this
 */
proto.emery.agents.ProcessMessageRequest.prototype.setSessionId = function(value) {
  return jspb.Message.setProto3StringField(this, 9, value);
};


/**
 * optional string user_api_key = 10;
 * @return {string}
 */
proto.emery.agents.ProcessMessageRequest.prototype.getUserApiKey = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 10, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.ProcessMessageRequest} returns this
 */
proto.emery.agents.ProcessMessageRequest.prototype.setUserApiKey = function(value) {
  return jspb.Message.setProto3StringField(this, 10, value);
};



/**
 * Oneof group definitions for this message. Each group defines the field
 * numbers belonging to that group. When of these fields' value is set, all
 * other fields in the group are cleared. During deserialization, if multiple
 * fields are encountered for a group, only the last value seen will be kept.
 * @private {!Array<!Array<number>>}
 * @const
 */
proto.emery.agents.ProcessMessageResponse.oneofGroups_ = [[1,3,4,5]];

/**
 * @enum {number}
 */
proto.emery.agents.ProcessMessageResponse.ResponseCase = {
  RESPONSE_NOT_SET: 0,
  CONTENT_CHUNK: 1,
  COMPLETE: 3,
  ERROR: 4,
  STEP_PROGRESS: 5
};

/**
 * @return {proto.emery.agents.ProcessMessageResponse.ResponseCase}
 */
proto.emery.agents.ProcessMessageResponse.prototype.getResponseCase = function() {
  return /** @type {proto.emery.agents.ProcessMessageResponse.ResponseCase} */(jspb.Message.computeOneofCase(this, proto.emery.agents.ProcessMessageResponse.oneofGroups_[0]));
};



if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.emery.agents.ProcessMessageResponse.prototype.toObject = function(opt_includeInstance) {
  return proto.emery.agents.ProcessMessageResponse.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.emery.agents.ProcessMessageResponse} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.ProcessMessageResponse.toObject = function(includeInstance, msg) {
  var f, obj = {
    contentChunk: (f = msg.getContentChunk()) && proto.emery.agents.ContentChunk.toObject(includeInstance, f),
    complete: (f = msg.getComplete()) && proto.emery.agents.ProcessingComplete.toObject(includeInstance, f),
    error: (f = msg.getError()) && proto.emery.agents.ProcessingError.toObject(includeInstance, f),
    stepProgress: (f = msg.getStepProgress()) && proto.emery.agents.StepProgress.toObject(includeInstance, f),
    timestamp: jspb.Message.getFieldWithDefault(msg, 6, 0)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.emery.agents.ProcessMessageResponse}
 */
proto.emery.agents.ProcessMessageResponse.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.emery.agents.ProcessMessageResponse;
  return proto.emery.agents.ProcessMessageResponse.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.emery.agents.ProcessMessageResponse} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.emery.agents.ProcessMessageResponse}
 */
proto.emery.agents.ProcessMessageResponse.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = new proto.emery.agents.ContentChunk;
      reader.readMessage(value,proto.emery.agents.ContentChunk.deserializeBinaryFromReader);
      msg.setContentChunk(value);
      break;
    case 3:
      var value = new proto.emery.agents.ProcessingComplete;
      reader.readMessage(value,proto.emery.agents.ProcessingComplete.deserializeBinaryFromReader);
      msg.setComplete(value);
      break;
    case 4:
      var value = new proto.emery.agents.ProcessingError;
      reader.readMessage(value,proto.emery.agents.ProcessingError.deserializeBinaryFromReader);
      msg.setError(value);
      break;
    case 5:
      var value = new proto.emery.agents.StepProgress;
      reader.readMessage(value,proto.emery.agents.StepProgress.deserializeBinaryFromReader);
      msg.setStepProgress(value);
      break;
    case 6:
      var value = /** @type {number} */ (reader.readInt64());
      msg.setTimestamp(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.emery.agents.ProcessMessageResponse.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.emery.agents.ProcessMessageResponse.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.emery.agents.ProcessMessageResponse} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.ProcessMessageResponse.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getContentChunk();
  if (f != null) {
    writer.writeMessage(
      1,
      f,
      proto.emery.agents.ContentChunk.serializeBinaryToWriter
    );
  }
  f = message.getComplete();
  if (f != null) {
    writer.writeMessage(
      3,
      f,
      proto.emery.agents.ProcessingComplete.serializeBinaryToWriter
    );
  }
  f = message.getError();
  if (f != null) {
    writer.writeMessage(
      4,
      f,
      proto.emery.agents.ProcessingError.serializeBinaryToWriter
    );
  }
  f = message.getStepProgress();
  if (f != null) {
    writer.writeMessage(
      5,
      f,
      proto.emery.agents.StepProgress.serializeBinaryToWriter
    );
  }
  f = message.getTimestamp();
  if (f !== 0) {
    writer.writeInt64(
      6,
      f
    );
  }
};


/**
 * optional ContentChunk content_chunk = 1;
 * @return {?proto.emery.agents.ContentChunk}
 */
proto.emery.agents.ProcessMessageResponse.prototype.getContentChunk = function() {
  return /** @type{?proto.emery.agents.ContentChunk} */ (
    jspb.Message.getWrapperField(this, proto.emery.agents.ContentChunk, 1));
};


/**
 * @param {?proto.emery.agents.ContentChunk|undefined} value
 * @return {!proto.emery.agents.ProcessMessageResponse} returns this
*/
proto.emery.agents.ProcessMessageResponse.prototype.setContentChunk = function(value) {
  return jspb.Message.setOneofWrapperField(this, 1, proto.emery.agents.ProcessMessageResponse.oneofGroups_[0], value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.emery.agents.ProcessMessageResponse} returns this
 */
proto.emery.agents.ProcessMessageResponse.prototype.clearContentChunk = function() {
  return this.setContentChunk(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.emery.agents.ProcessMessageResponse.prototype.hasContentChunk = function() {
  return jspb.Message.getField(this, 1) != null;
};


/**
 * optional ProcessingComplete complete = 3;
 * @return {?proto.emery.agents.ProcessingComplete}
 */
proto.emery.agents.ProcessMessageResponse.prototype.getComplete = function() {
  return /** @type{?proto.emery.agents.ProcessingComplete} */ (
    jspb.Message.getWrapperField(this, proto.emery.agents.ProcessingComplete, 3));
};


/**
 * @param {?proto.emery.agents.ProcessingComplete|undefined} value
 * @return {!proto.emery.agents.ProcessMessageResponse} returns this
*/
proto.emery.agents.ProcessMessageResponse.prototype.setComplete = function(value) {
  return jspb.Message.setOneofWrapperField(this, 3, proto.emery.agents.ProcessMessageResponse.oneofGroups_[0], value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.emery.agents.ProcessMessageResponse} returns this
 */
proto.emery.agents.ProcessMessageResponse.prototype.clearComplete = function() {
  return this.setComplete(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.emery.agents.ProcessMessageResponse.prototype.hasComplete = function() {
  return jspb.Message.getField(this, 3) != null;
};


/**
 * optional ProcessingError error = 4;
 * @return {?proto.emery.agents.ProcessingError}
 */
proto.emery.agents.ProcessMessageResponse.prototype.getError = function() {
  return /** @type{?proto.emery.agents.ProcessingError} */ (
    jspb.Message.getWrapperField(this, proto.emery.agents.ProcessingError, 4));
};


/**
 * @param {?proto.emery.agents.ProcessingError|undefined} value
 * @return {!proto.emery.agents.ProcessMessageResponse} returns this
*/
proto.emery.agents.ProcessMessageResponse.prototype.setError = function(value) {
  return jspb.Message.setOneofWrapperField(this, 4, proto.emery.agents.ProcessMessageResponse.oneofGroups_[0], value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.emery.agents.ProcessMessageResponse} returns this
 */
proto.emery.agents.ProcessMessageResponse.prototype.clearError = function() {
  return this.setError(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.emery.agents.ProcessMessageResponse.prototype.hasError = function() {
  return jspb.Message.getField(this, 4) != null;
};


/**
 * optional StepProgress step_progress = 5;
 * @return {?proto.emery.agents.StepProgress}
 */
proto.emery.agents.ProcessMessageResponse.prototype.getStepProgress = function() {
  return /** @type{?proto.emery.agents.StepProgress} */ (
    jspb.Message.getWrapperField(this, proto.emery.agents.StepProgress, 5));
};


/**
 * @param {?proto.emery.agents.StepProgress|undefined} value
 * @return {!proto.emery.agents.ProcessMessageResponse} returns this
*/
proto.emery.agents.ProcessMessageResponse.prototype.setStepProgress = function(value) {
  return jspb.Message.setOneofWrapperField(this, 5, proto.emery.agents.ProcessMessageResponse.oneofGroups_[0], value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.emery.agents.ProcessMessageResponse} returns this
 */
proto.emery.agents.ProcessMessageResponse.prototype.clearStepProgress = function() {
  return this.setStepProgress(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.emery.agents.ProcessMessageResponse.prototype.hasStepProgress = function() {
  return jspb.Message.getField(this, 5) != null;
};


/**
 * optional int64 timestamp = 6;
 * @return {number}
 */
proto.emery.agents.ProcessMessageResponse.prototype.getTimestamp = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 6, 0));
};


/**
 * @param {number} value
 * @return {!proto.emery.agents.ProcessMessageResponse} returns this
 */
proto.emery.agents.ProcessMessageResponse.prototype.setTimestamp = function(value) {
  return jspb.Message.setProto3IntField(this, 6, value);
};



/**
 * Oneof group definitions for this message. Each group defines the field
 * numbers belonging to that group. When of these fields' value is set, all
 * other fields in the group are cleared. During deserialization, if multiple
 * fields are encountered for a group, only the last value seen will be kept.
 * @private {!Array<!Array<number>>}
 * @const
 */
proto.emery.agents.MessagePart.oneofGroups_ = [[1,2,3]];

/**
 * @enum {number}
 */
proto.emery.agents.MessagePart.PartCase = {
  PART_NOT_SET: 0,
  TEXT: 1,
  IMAGE_URL: 2,
  FILE: 3
};

/**
 * @return {proto.emery.agents.MessagePart.PartCase}
 */
proto.emery.agents.MessagePart.prototype.getPartCase = function() {
  return /** @type {proto.emery.agents.MessagePart.PartCase} */(jspb.Message.computeOneofCase(this, proto.emery.agents.MessagePart.oneofGroups_[0]));
};



if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.emery.agents.MessagePart.prototype.toObject = function(opt_includeInstance) {
  return proto.emery.agents.MessagePart.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.emery.agents.MessagePart} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.MessagePart.toObject = function(includeInstance, msg) {
  var f, obj = {
    text: (f = msg.getText()) && proto.emery.agents.TextPart.toObject(includeInstance, f),
    imageUrl: (f = msg.getImageUrl()) && proto.emery.agents.ImageUrlPart.toObject(includeInstance, f),
    file: (f = msg.getFile()) && proto.emery.agents.FilePart.toObject(includeInstance, f)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.emery.agents.MessagePart}
 */
proto.emery.agents.MessagePart.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.emery.agents.MessagePart;
  return proto.emery.agents.MessagePart.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.emery.agents.MessagePart} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.emery.agents.MessagePart}
 */
proto.emery.agents.MessagePart.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = new proto.emery.agents.TextPart;
      reader.readMessage(value,proto.emery.agents.TextPart.deserializeBinaryFromReader);
      msg.setText(value);
      break;
    case 2:
      var value = new proto.emery.agents.ImageUrlPart;
      reader.readMessage(value,proto.emery.agents.ImageUrlPart.deserializeBinaryFromReader);
      msg.setImageUrl(value);
      break;
    case 3:
      var value = new proto.emery.agents.FilePart;
      reader.readMessage(value,proto.emery.agents.FilePart.deserializeBinaryFromReader);
      msg.setFile(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.emery.agents.MessagePart.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.emery.agents.MessagePart.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.emery.agents.MessagePart} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.MessagePart.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getText();
  if (f != null) {
    writer.writeMessage(
      1,
      f,
      proto.emery.agents.TextPart.serializeBinaryToWriter
    );
  }
  f = message.getImageUrl();
  if (f != null) {
    writer.writeMessage(
      2,
      f,
      proto.emery.agents.ImageUrlPart.serializeBinaryToWriter
    );
  }
  f = message.getFile();
  if (f != null) {
    writer.writeMessage(
      3,
      f,
      proto.emery.agents.FilePart.serializeBinaryToWriter
    );
  }
};


/**
 * optional TextPart text = 1;
 * @return {?proto.emery.agents.TextPart}
 */
proto.emery.agents.MessagePart.prototype.getText = function() {
  return /** @type{?proto.emery.agents.TextPart} */ (
    jspb.Message.getWrapperField(this, proto.emery.agents.TextPart, 1));
};


/**
 * @param {?proto.emery.agents.TextPart|undefined} value
 * @return {!proto.emery.agents.MessagePart} returns this
*/
proto.emery.agents.MessagePart.prototype.setText = function(value) {
  return jspb.Message.setOneofWrapperField(this, 1, proto.emery.agents.MessagePart.oneofGroups_[0], value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.emery.agents.MessagePart} returns this
 */
proto.emery.agents.MessagePart.prototype.clearText = function() {
  return this.setText(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.emery.agents.MessagePart.prototype.hasText = function() {
  return jspb.Message.getField(this, 1) != null;
};


/**
 * optional ImageUrlPart image_url = 2;
 * @return {?proto.emery.agents.ImageUrlPart}
 */
proto.emery.agents.MessagePart.prototype.getImageUrl = function() {
  return /** @type{?proto.emery.agents.ImageUrlPart} */ (
    jspb.Message.getWrapperField(this, proto.emery.agents.ImageUrlPart, 2));
};


/**
 * @param {?proto.emery.agents.ImageUrlPart|undefined} value
 * @return {!proto.emery.agents.MessagePart} returns this
*/
proto.emery.agents.MessagePart.prototype.setImageUrl = function(value) {
  return jspb.Message.setOneofWrapperField(this, 2, proto.emery.agents.MessagePart.oneofGroups_[0], value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.emery.agents.MessagePart} returns this
 */
proto.emery.agents.MessagePart.prototype.clearImageUrl = function() {
  return this.setImageUrl(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.emery.agents.MessagePart.prototype.hasImageUrl = function() {
  return jspb.Message.getField(this, 2) != null;
};


/**
 * optional FilePart file = 3;
 * @return {?proto.emery.agents.FilePart}
 */
proto.emery.agents.MessagePart.prototype.getFile = function() {
  return /** @type{?proto.emery.agents.FilePart} */ (
    jspb.Message.getWrapperField(this, proto.emery.agents.FilePart, 3));
};


/**
 * @param {?proto.emery.agents.FilePart|undefined} value
 * @return {!proto.emery.agents.MessagePart} returns this
*/
proto.emery.agents.MessagePart.prototype.setFile = function(value) {
  return jspb.Message.setOneofWrapperField(this, 3, proto.emery.agents.MessagePart.oneofGroups_[0], value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.emery.agents.MessagePart} returns this
 */
proto.emery.agents.MessagePart.prototype.clearFile = function() {
  return this.setFile(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.emery.agents.MessagePart.prototype.hasFile = function() {
  return jspb.Message.getField(this, 3) != null;
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.emery.agents.TextPart.prototype.toObject = function(opt_includeInstance) {
  return proto.emery.agents.TextPart.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.emery.agents.TextPart} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.TextPart.toObject = function(includeInstance, msg) {
  var f, obj = {
    text: jspb.Message.getFieldWithDefault(msg, 1, "")
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.emery.agents.TextPart}
 */
proto.emery.agents.TextPart.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.emery.agents.TextPart;
  return proto.emery.agents.TextPart.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.emery.agents.TextPart} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.emery.agents.TextPart}
 */
proto.emery.agents.TextPart.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setText(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.emery.agents.TextPart.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.emery.agents.TextPart.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.emery.agents.TextPart} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.TextPart.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getText();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
};


/**
 * optional string text = 1;
 * @return {string}
 */
proto.emery.agents.TextPart.prototype.getText = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.TextPart} returns this
 */
proto.emery.agents.TextPart.prototype.setText = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.emery.agents.ImageUrlPart.prototype.toObject = function(opt_includeInstance) {
  return proto.emery.agents.ImageUrlPart.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.emery.agents.ImageUrlPart} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.ImageUrlPart.toObject = function(includeInstance, msg) {
  var f, obj = {
    url: jspb.Message.getFieldWithDefault(msg, 1, "")
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.emery.agents.ImageUrlPart}
 */
proto.emery.agents.ImageUrlPart.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.emery.agents.ImageUrlPart;
  return proto.emery.agents.ImageUrlPart.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.emery.agents.ImageUrlPart} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.emery.agents.ImageUrlPart}
 */
proto.emery.agents.ImageUrlPart.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setUrl(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.emery.agents.ImageUrlPart.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.emery.agents.ImageUrlPart.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.emery.agents.ImageUrlPart} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.ImageUrlPart.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getUrl();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
};


/**
 * optional string url = 1;
 * @return {string}
 */
proto.emery.agents.ImageUrlPart.prototype.getUrl = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.ImageUrlPart} returns this
 */
proto.emery.agents.ImageUrlPart.prototype.setUrl = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.emery.agents.FilePart.prototype.toObject = function(opt_includeInstance) {
  return proto.emery.agents.FilePart.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.emery.agents.FilePart} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.FilePart.toObject = function(includeInstance, msg) {
  var f, obj = {
    url: jspb.Message.getFieldWithDefault(msg, 1, ""),
    mimeType: jspb.Message.getFieldWithDefault(msg, 2, ""),
    filename: jspb.Message.getFieldWithDefault(msg, 3, ""),
    size: jspb.Message.getFieldWithDefault(msg, 4, 0)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.emery.agents.FilePart}
 */
proto.emery.agents.FilePart.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.emery.agents.FilePart;
  return proto.emery.agents.FilePart.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.emery.agents.FilePart} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.emery.agents.FilePart}
 */
proto.emery.agents.FilePart.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setUrl(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setMimeType(value);
      break;
    case 3:
      var value = /** @type {string} */ (reader.readString());
      msg.setFilename(value);
      break;
    case 4:
      var value = /** @type {number} */ (reader.readInt64());
      msg.setSize(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.emery.agents.FilePart.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.emery.agents.FilePart.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.emery.agents.FilePart} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.FilePart.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getUrl();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getMimeType();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
  f = message.getFilename();
  if (f.length > 0) {
    writer.writeString(
      3,
      f
    );
  }
  f = message.getSize();
  if (f !== 0) {
    writer.writeInt64(
      4,
      f
    );
  }
};


/**
 * optional string url = 1;
 * @return {string}
 */
proto.emery.agents.FilePart.prototype.getUrl = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.FilePart} returns this
 */
proto.emery.agents.FilePart.prototype.setUrl = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional string mime_type = 2;
 * @return {string}
 */
proto.emery.agents.FilePart.prototype.getMimeType = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.FilePart} returns this
 */
proto.emery.agents.FilePart.prototype.setMimeType = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};


/**
 * optional string filename = 3;
 * @return {string}
 */
proto.emery.agents.FilePart.prototype.getFilename = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 3, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.FilePart} returns this
 */
proto.emery.agents.FilePart.prototype.setFilename = function(value) {
  return jspb.Message.setProto3StringField(this, 3, value);
};


/**
 * optional int64 size = 4;
 * @return {number}
 */
proto.emery.agents.FilePart.prototype.getSize = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 4, 0));
};


/**
 * @param {number} value
 * @return {!proto.emery.agents.FilePart} returns this
 */
proto.emery.agents.FilePart.prototype.setSize = function(value) {
  return jspb.Message.setProto3IntField(this, 4, value);
};



/**
 * List of repeated fields within this message type.
 * @private {!Array<number>}
 * @const
 */
proto.emery.agents.HistoryMessage.repeatedFields_ = [2];



if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.emery.agents.HistoryMessage.prototype.toObject = function(opt_includeInstance) {
  return proto.emery.agents.HistoryMessage.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.emery.agents.HistoryMessage} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.HistoryMessage.toObject = function(includeInstance, msg) {
  var f, obj = {
    role: jspb.Message.getFieldWithDefault(msg, 1, ""),
    contentPartsList: jspb.Message.toObjectList(msg.getContentPartsList(),
    proto.emery.agents.MessagePart.toObject, includeInstance),
    timestamp: jspb.Message.getFieldWithDefault(msg, 3, 0)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.emery.agents.HistoryMessage}
 */
proto.emery.agents.HistoryMessage.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.emery.agents.HistoryMessage;
  return proto.emery.agents.HistoryMessage.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.emery.agents.HistoryMessage} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.emery.agents.HistoryMessage}
 */
proto.emery.agents.HistoryMessage.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setRole(value);
      break;
    case 2:
      var value = new proto.emery.agents.MessagePart;
      reader.readMessage(value,proto.emery.agents.MessagePart.deserializeBinaryFromReader);
      msg.addContentParts(value);
      break;
    case 3:
      var value = /** @type {number} */ (reader.readInt64());
      msg.setTimestamp(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.emery.agents.HistoryMessage.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.emery.agents.HistoryMessage.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.emery.agents.HistoryMessage} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.HistoryMessage.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getRole();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getContentPartsList();
  if (f.length > 0) {
    writer.writeRepeatedMessage(
      2,
      f,
      proto.emery.agents.MessagePart.serializeBinaryToWriter
    );
  }
  f = message.getTimestamp();
  if (f !== 0) {
    writer.writeInt64(
      3,
      f
    );
  }
};


/**
 * optional string role = 1;
 * @return {string}
 */
proto.emery.agents.HistoryMessage.prototype.getRole = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.HistoryMessage} returns this
 */
proto.emery.agents.HistoryMessage.prototype.setRole = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * repeated MessagePart content_parts = 2;
 * @return {!Array<!proto.emery.agents.MessagePart>}
 */
proto.emery.agents.HistoryMessage.prototype.getContentPartsList = function() {
  return /** @type{!Array<!proto.emery.agents.MessagePart>} */ (
    jspb.Message.getRepeatedWrapperField(this, proto.emery.agents.MessagePart, 2));
};


/**
 * @param {!Array<!proto.emery.agents.MessagePart>} value
 * @return {!proto.emery.agents.HistoryMessage} returns this
*/
proto.emery.agents.HistoryMessage.prototype.setContentPartsList = function(value) {
  return jspb.Message.setRepeatedWrapperField(this, 2, value);
};


/**
 * @param {!proto.emery.agents.MessagePart=} opt_value
 * @param {number=} opt_index
 * @return {!proto.emery.agents.MessagePart}
 */
proto.emery.agents.HistoryMessage.prototype.addContentParts = function(opt_value, opt_index) {
  return jspb.Message.addToRepeatedWrapperField(this, 2, opt_value, proto.emery.agents.MessagePart, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.emery.agents.HistoryMessage} returns this
 */
proto.emery.agents.HistoryMessage.prototype.clearContentPartsList = function() {
  return this.setContentPartsList([]);
};


/**
 * optional int64 timestamp = 3;
 * @return {number}
 */
proto.emery.agents.HistoryMessage.prototype.getTimestamp = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 3, 0));
};


/**
 * @param {number} value
 * @return {!proto.emery.agents.HistoryMessage} returns this
 */
proto.emery.agents.HistoryMessage.prototype.setTimestamp = function(value) {
  return jspb.Message.setProto3IntField(this, 3, value);
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.emery.agents.ContentChunk.prototype.toObject = function(opt_includeInstance) {
  return proto.emery.agents.ContentChunk.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.emery.agents.ContentChunk} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.ContentChunk.toObject = function(includeInstance, msg) {
  var f, obj = {
    content: jspb.Message.getFieldWithDefault(msg, 1, ""),
    sequence: jspb.Message.getFieldWithDefault(msg, 2, 0)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.emery.agents.ContentChunk}
 */
proto.emery.agents.ContentChunk.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.emery.agents.ContentChunk;
  return proto.emery.agents.ContentChunk.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.emery.agents.ContentChunk} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.emery.agents.ContentChunk}
 */
proto.emery.agents.ContentChunk.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setContent(value);
      break;
    case 2:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setSequence(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.emery.agents.ContentChunk.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.emery.agents.ContentChunk.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.emery.agents.ContentChunk} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.ContentChunk.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getContent();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getSequence();
  if (f !== 0) {
    writer.writeInt32(
      2,
      f
    );
  }
};


/**
 * optional string content = 1;
 * @return {string}
 */
proto.emery.agents.ContentChunk.prototype.getContent = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.ContentChunk} returns this
 */
proto.emery.agents.ContentChunk.prototype.setContent = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional int32 sequence = 2;
 * @return {number}
 */
proto.emery.agents.ContentChunk.prototype.getSequence = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 2, 0));
};


/**
 * @param {number} value
 * @return {!proto.emery.agents.ContentChunk} returns this
 */
proto.emery.agents.ContentChunk.prototype.setSequence = function(value) {
  return jspb.Message.setProto3IntField(this, 2, value);
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.emery.agents.ProcessingComplete.prototype.toObject = function(opt_includeInstance) {
  return proto.emery.agents.ProcessingComplete.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.emery.agents.ProcessingComplete} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.ProcessingComplete.toObject = function(includeInstance, msg) {
  var f, obj = {
    modelUsed: jspb.Message.getFieldWithDefault(msg, 1, ""),
    totalTokens: jspb.Message.getFieldWithDefault(msg, 2, 0),
    processingTimeMs: jspb.Message.getFieldWithDefault(msg, 3, 0),
    metadataMap: (f = msg.getMetadataMap()) ? f.toObject(includeInstance, undefined) : [],
    tokenUsage: (f = msg.getTokenUsage()) && proto.emery.agents.TokenUsage.toObject(includeInstance, f)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.emery.agents.ProcessingComplete}
 */
proto.emery.agents.ProcessingComplete.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.emery.agents.ProcessingComplete;
  return proto.emery.agents.ProcessingComplete.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.emery.agents.ProcessingComplete} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.emery.agents.ProcessingComplete}
 */
proto.emery.agents.ProcessingComplete.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setModelUsed(value);
      break;
    case 2:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setTotalTokens(value);
      break;
    case 3:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setProcessingTimeMs(value);
      break;
    case 4:
      var value = msg.getMetadataMap();
      reader.readMessage(value, function(message, reader) {
        jspb.Map.deserializeBinary(message, reader, jspb.BinaryReader.prototype.readString, jspb.BinaryReader.prototype.readString, null, "", "");
         });
      break;
    case 5:
      var value = new proto.emery.agents.TokenUsage;
      reader.readMessage(value,proto.emery.agents.TokenUsage.deserializeBinaryFromReader);
      msg.setTokenUsage(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.emery.agents.ProcessingComplete.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.emery.agents.ProcessingComplete.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.emery.agents.ProcessingComplete} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.ProcessingComplete.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getModelUsed();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getTotalTokens();
  if (f !== 0) {
    writer.writeInt32(
      2,
      f
    );
  }
  f = message.getProcessingTimeMs();
  if (f !== 0) {
    writer.writeInt32(
      3,
      f
    );
  }
  f = message.getMetadataMap(true);
  if (f && f.getLength() > 0) {
    f.serializeBinary(4, writer, jspb.BinaryWriter.prototype.writeString, jspb.BinaryWriter.prototype.writeString);
  }
  f = message.getTokenUsage();
  if (f != null) {
    writer.writeMessage(
      5,
      f,
      proto.emery.agents.TokenUsage.serializeBinaryToWriter
    );
  }
};


/**
 * optional string model_used = 1;
 * @return {string}
 */
proto.emery.agents.ProcessingComplete.prototype.getModelUsed = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.ProcessingComplete} returns this
 */
proto.emery.agents.ProcessingComplete.prototype.setModelUsed = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional int32 total_tokens = 2;
 * @return {number}
 */
proto.emery.agents.ProcessingComplete.prototype.getTotalTokens = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 2, 0));
};


/**
 * @param {number} value
 * @return {!proto.emery.agents.ProcessingComplete} returns this
 */
proto.emery.agents.ProcessingComplete.prototype.setTotalTokens = function(value) {
  return jspb.Message.setProto3IntField(this, 2, value);
};


/**
 * optional int32 processing_time_ms = 3;
 * @return {number}
 */
proto.emery.agents.ProcessingComplete.prototype.getProcessingTimeMs = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 3, 0));
};


/**
 * @param {number} value
 * @return {!proto.emery.agents.ProcessingComplete} returns this
 */
proto.emery.agents.ProcessingComplete.prototype.setProcessingTimeMs = function(value) {
  return jspb.Message.setProto3IntField(this, 3, value);
};


/**
 * map<string, string> metadata = 4;
 * @param {boolean=} opt_noLazyCreate Do not create the map if
 * empty, instead returning `undefined`
 * @return {!jspb.Map<string,string>}
 */
proto.emery.agents.ProcessingComplete.prototype.getMetadataMap = function(opt_noLazyCreate) {
  return /** @type {!jspb.Map<string,string>} */ (
      jspb.Message.getMapField(this, 4, opt_noLazyCreate,
      null));
};


/**
 * Clears values from the map. The map will be non-null.
 * @return {!proto.emery.agents.ProcessingComplete} returns this
 */
proto.emery.agents.ProcessingComplete.prototype.clearMetadataMap = function() {
  this.getMetadataMap().clear();
  return this;};


/**
 * optional TokenUsage token_usage = 5;
 * @return {?proto.emery.agents.TokenUsage}
 */
proto.emery.agents.ProcessingComplete.prototype.getTokenUsage = function() {
  return /** @type{?proto.emery.agents.TokenUsage} */ (
    jspb.Message.getWrapperField(this, proto.emery.agents.TokenUsage, 5));
};


/**
 * @param {?proto.emery.agents.TokenUsage|undefined} value
 * @return {!proto.emery.agents.ProcessingComplete} returns this
*/
proto.emery.agents.ProcessingComplete.prototype.setTokenUsage = function(value) {
  return jspb.Message.setWrapperField(this, 5, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.emery.agents.ProcessingComplete} returns this
 */
proto.emery.agents.ProcessingComplete.prototype.clearTokenUsage = function() {
  return this.setTokenUsage(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.emery.agents.ProcessingComplete.prototype.hasTokenUsage = function() {
  return jspb.Message.getField(this, 5) != null;
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.emery.agents.ProcessingError.prototype.toObject = function(opt_includeInstance) {
  return proto.emery.agents.ProcessingError.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.emery.agents.ProcessingError} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.ProcessingError.toObject = function(includeInstance, msg) {
  var f, obj = {
    errorCode: jspb.Message.getFieldWithDefault(msg, 1, ""),
    errorMessage: jspb.Message.getFieldWithDefault(msg, 2, ""),
    errorDetailsMap: (f = msg.getErrorDetailsMap()) ? f.toObject(includeInstance, undefined) : [],
    hint: jspb.Message.getFieldWithDefault(msg, 4, ""),
    canRetry: jspb.Message.getBooleanFieldWithDefault(msg, 5, false),
    autoRetry: jspb.Message.getBooleanFieldWithDefault(msg, 6, false),
    sessionReset: jspb.Message.getBooleanFieldWithDefault(msg, 7, false)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.emery.agents.ProcessingError}
 */
proto.emery.agents.ProcessingError.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.emery.agents.ProcessingError;
  return proto.emery.agents.ProcessingError.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.emery.agents.ProcessingError} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.emery.agents.ProcessingError}
 */
proto.emery.agents.ProcessingError.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setErrorCode(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setErrorMessage(value);
      break;
    case 3:
      var value = msg.getErrorDetailsMap();
      reader.readMessage(value, function(message, reader) {
        jspb.Map.deserializeBinary(message, reader, jspb.BinaryReader.prototype.readString, jspb.BinaryReader.prototype.readString, null, "", "");
         });
      break;
    case 4:
      var value = /** @type {string} */ (reader.readString());
      msg.setHint(value);
      break;
    case 5:
      var value = /** @type {boolean} */ (reader.readBool());
      msg.setCanRetry(value);
      break;
    case 6:
      var value = /** @type {boolean} */ (reader.readBool());
      msg.setAutoRetry(value);
      break;
    case 7:
      var value = /** @type {boolean} */ (reader.readBool());
      msg.setSessionReset(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.emery.agents.ProcessingError.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.emery.agents.ProcessingError.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.emery.agents.ProcessingError} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.ProcessingError.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getErrorCode();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getErrorMessage();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
  f = message.getErrorDetailsMap(true);
  if (f && f.getLength() > 0) {
    f.serializeBinary(3, writer, jspb.BinaryWriter.prototype.writeString, jspb.BinaryWriter.prototype.writeString);
  }
  f = message.getHint();
  if (f.length > 0) {
    writer.writeString(
      4,
      f
    );
  }
  f = message.getCanRetry();
  if (f) {
    writer.writeBool(
      5,
      f
    );
  }
  f = message.getAutoRetry();
  if (f) {
    writer.writeBool(
      6,
      f
    );
  }
  f = message.getSessionReset();
  if (f) {
    writer.writeBool(
      7,
      f
    );
  }
};


/**
 * optional string error_code = 1;
 * @return {string}
 */
proto.emery.agents.ProcessingError.prototype.getErrorCode = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.ProcessingError} returns this
 */
proto.emery.agents.ProcessingError.prototype.setErrorCode = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional string error_message = 2;
 * @return {string}
 */
proto.emery.agents.ProcessingError.prototype.getErrorMessage = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.ProcessingError} returns this
 */
proto.emery.agents.ProcessingError.prototype.setErrorMessage = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};


/**
 * map<string, string> error_details = 3;
 * @param {boolean=} opt_noLazyCreate Do not create the map if
 * empty, instead returning `undefined`
 * @return {!jspb.Map<string,string>}
 */
proto.emery.agents.ProcessingError.prototype.getErrorDetailsMap = function(opt_noLazyCreate) {
  return /** @type {!jspb.Map<string,string>} */ (
      jspb.Message.getMapField(this, 3, opt_noLazyCreate,
      null));
};


/**
 * Clears values from the map. The map will be non-null.
 * @return {!proto.emery.agents.ProcessingError} returns this
 */
proto.emery.agents.ProcessingError.prototype.clearErrorDetailsMap = function() {
  this.getErrorDetailsMap().clear();
  return this;};


/**
 * optional string hint = 4;
 * @return {string}
 */
proto.emery.agents.ProcessingError.prototype.getHint = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 4, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.ProcessingError} returns this
 */
proto.emery.agents.ProcessingError.prototype.setHint = function(value) {
  return jspb.Message.setProto3StringField(this, 4, value);
};


/**
 * optional bool can_retry = 5;
 * @return {boolean}
 */
proto.emery.agents.ProcessingError.prototype.getCanRetry = function() {
  return /** @type {boolean} */ (jspb.Message.getBooleanFieldWithDefault(this, 5, false));
};


/**
 * @param {boolean} value
 * @return {!proto.emery.agents.ProcessingError} returns this
 */
proto.emery.agents.ProcessingError.prototype.setCanRetry = function(value) {
  return jspb.Message.setProto3BooleanField(this, 5, value);
};


/**
 * optional bool auto_retry = 6;
 * @return {boolean}
 */
proto.emery.agents.ProcessingError.prototype.getAutoRetry = function() {
  return /** @type {boolean} */ (jspb.Message.getBooleanFieldWithDefault(this, 6, false));
};


/**
 * @param {boolean} value
 * @return {!proto.emery.agents.ProcessingError} returns this
 */
proto.emery.agents.ProcessingError.prototype.setAutoRetry = function(value) {
  return jspb.Message.setProto3BooleanField(this, 6, value);
};


/**
 * optional bool session_reset = 7;
 * @return {boolean}
 */
proto.emery.agents.ProcessingError.prototype.getSessionReset = function() {
  return /** @type {boolean} */ (jspb.Message.getBooleanFieldWithDefault(this, 7, false));
};


/**
 * @param {boolean} value
 * @return {!proto.emery.agents.ProcessingError} returns this
 */
proto.emery.agents.ProcessingError.prototype.setSessionReset = function(value) {
  return jspb.Message.setProto3BooleanField(this, 7, value);
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.emery.agents.StepProgress.prototype.toObject = function(opt_includeInstance) {
  return proto.emery.agents.StepProgress.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.emery.agents.StepProgress} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.StepProgress.toObject = function(includeInstance, msg) {
  var f, obj = {
    stepType: jspb.Message.getFieldWithDefault(msg, 1, 0),
    stepName: jspb.Message.getFieldWithDefault(msg, 2, ""),
    content: jspb.Message.getFieldWithDefault(msg, 3, ""),
    metadataMap: (f = msg.getMetadataMap()) ? f.toObject(includeInstance, undefined) : [],
    stepIndex: jspb.Message.getFieldWithDefault(msg, 5, 0)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.emery.agents.StepProgress}
 */
proto.emery.agents.StepProgress.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.emery.agents.StepProgress;
  return proto.emery.agents.StepProgress.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.emery.agents.StepProgress} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.emery.agents.StepProgress}
 */
proto.emery.agents.StepProgress.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {!proto.emery.agents.StepType} */ (reader.readEnum());
      msg.setStepType(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setStepName(value);
      break;
    case 3:
      var value = /** @type {string} */ (reader.readString());
      msg.setContent(value);
      break;
    case 4:
      var value = msg.getMetadataMap();
      reader.readMessage(value, function(message, reader) {
        jspb.Map.deserializeBinary(message, reader, jspb.BinaryReader.prototype.readString, jspb.BinaryReader.prototype.readString, null, "", "");
         });
      break;
    case 5:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setStepIndex(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.emery.agents.StepProgress.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.emery.agents.StepProgress.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.emery.agents.StepProgress} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.StepProgress.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getStepType();
  if (f !== 0.0) {
    writer.writeEnum(
      1,
      f
    );
  }
  f = message.getStepName();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
  f = message.getContent();
  if (f.length > 0) {
    writer.writeString(
      3,
      f
    );
  }
  f = message.getMetadataMap(true);
  if (f && f.getLength() > 0) {
    f.serializeBinary(4, writer, jspb.BinaryWriter.prototype.writeString, jspb.BinaryWriter.prototype.writeString);
  }
  f = message.getStepIndex();
  if (f !== 0) {
    writer.writeInt32(
      5,
      f
    );
  }
};


/**
 * optional StepType step_type = 1;
 * @return {!proto.emery.agents.StepType}
 */
proto.emery.agents.StepProgress.prototype.getStepType = function() {
  return /** @type {!proto.emery.agents.StepType} */ (jspb.Message.getFieldWithDefault(this, 1, 0));
};


/**
 * @param {!proto.emery.agents.StepType} value
 * @return {!proto.emery.agents.StepProgress} returns this
 */
proto.emery.agents.StepProgress.prototype.setStepType = function(value) {
  return jspb.Message.setProto3EnumField(this, 1, value);
};


/**
 * optional string step_name = 2;
 * @return {string}
 */
proto.emery.agents.StepProgress.prototype.getStepName = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.StepProgress} returns this
 */
proto.emery.agents.StepProgress.prototype.setStepName = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};


/**
 * optional string content = 3;
 * @return {string}
 */
proto.emery.agents.StepProgress.prototype.getContent = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 3, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.StepProgress} returns this
 */
proto.emery.agents.StepProgress.prototype.setContent = function(value) {
  return jspb.Message.setProto3StringField(this, 3, value);
};


/**
 * map<string, string> metadata = 4;
 * @param {boolean=} opt_noLazyCreate Do not create the map if
 * empty, instead returning `undefined`
 * @return {!jspb.Map<string,string>}
 */
proto.emery.agents.StepProgress.prototype.getMetadataMap = function(opt_noLazyCreate) {
  return /** @type {!jspb.Map<string,string>} */ (
      jspb.Message.getMapField(this, 4, opt_noLazyCreate,
      null));
};


/**
 * Clears values from the map. The map will be non-null.
 * @return {!proto.emery.agents.StepProgress} returns this
 */
proto.emery.agents.StepProgress.prototype.clearMetadataMap = function() {
  this.getMetadataMap().clear();
  return this;};


/**
 * optional int32 step_index = 5;
 * @return {number}
 */
proto.emery.agents.StepProgress.prototype.getStepIndex = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 5, 0));
};


/**
 * @param {number} value
 * @return {!proto.emery.agents.StepProgress} returns this
 */
proto.emery.agents.StepProgress.prototype.setStepIndex = function(value) {
  return jspb.Message.setProto3IntField(this, 5, value);
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.emery.agents.CancelMessageRequest.prototype.toObject = function(opt_includeInstance) {
  return proto.emery.agents.CancelMessageRequest.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.emery.agents.CancelMessageRequest} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.CancelMessageRequest.toObject = function(includeInstance, msg) {
  var f, obj = {
    messageId: jspb.Message.getFieldWithDefault(msg, 1, ""),
    userId: jspb.Message.getFieldWithDefault(msg, 2, ""),
    organizationId: jspb.Message.getFieldWithDefault(msg, 3, 0)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.emery.agents.CancelMessageRequest}
 */
proto.emery.agents.CancelMessageRequest.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.emery.agents.CancelMessageRequest;
  return proto.emery.agents.CancelMessageRequest.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.emery.agents.CancelMessageRequest} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.emery.agents.CancelMessageRequest}
 */
proto.emery.agents.CancelMessageRequest.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setMessageId(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setUserId(value);
      break;
    case 3:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setOrganizationId(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.emery.agents.CancelMessageRequest.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.emery.agents.CancelMessageRequest.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.emery.agents.CancelMessageRequest} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.CancelMessageRequest.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getMessageId();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getUserId();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
  f = message.getOrganizationId();
  if (f !== 0) {
    writer.writeInt32(
      3,
      f
    );
  }
};


/**
 * optional string message_id = 1;
 * @return {string}
 */
proto.emery.agents.CancelMessageRequest.prototype.getMessageId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.CancelMessageRequest} returns this
 */
proto.emery.agents.CancelMessageRequest.prototype.setMessageId = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional string user_id = 2;
 * @return {string}
 */
proto.emery.agents.CancelMessageRequest.prototype.getUserId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.CancelMessageRequest} returns this
 */
proto.emery.agents.CancelMessageRequest.prototype.setUserId = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};


/**
 * optional int32 organization_id = 3;
 * @return {number}
 */
proto.emery.agents.CancelMessageRequest.prototype.getOrganizationId = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 3, 0));
};


/**
 * @param {number} value
 * @return {!proto.emery.agents.CancelMessageRequest} returns this
 */
proto.emery.agents.CancelMessageRequest.prototype.setOrganizationId = function(value) {
  return jspb.Message.setProto3IntField(this, 3, value);
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.emery.agents.CancelMessageResponse.prototype.toObject = function(opt_includeInstance) {
  return proto.emery.agents.CancelMessageResponse.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.emery.agents.CancelMessageResponse} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.CancelMessageResponse.toObject = function(includeInstance, msg) {
  var f, obj = {
    success: jspb.Message.getBooleanFieldWithDefault(msg, 1, false),
    message: jspb.Message.getFieldWithDefault(msg, 2, "")
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.emery.agents.CancelMessageResponse}
 */
proto.emery.agents.CancelMessageResponse.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.emery.agents.CancelMessageResponse;
  return proto.emery.agents.CancelMessageResponse.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.emery.agents.CancelMessageResponse} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.emery.agents.CancelMessageResponse}
 */
proto.emery.agents.CancelMessageResponse.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {boolean} */ (reader.readBool());
      msg.setSuccess(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setMessage(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.emery.agents.CancelMessageResponse.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.emery.agents.CancelMessageResponse.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.emery.agents.CancelMessageResponse} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.CancelMessageResponse.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getSuccess();
  if (f) {
    writer.writeBool(
      1,
      f
    );
  }
  f = message.getMessage();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
};


/**
 * optional bool success = 1;
 * @return {boolean}
 */
proto.emery.agents.CancelMessageResponse.prototype.getSuccess = function() {
  return /** @type {boolean} */ (jspb.Message.getBooleanFieldWithDefault(this, 1, false));
};


/**
 * @param {boolean} value
 * @return {!proto.emery.agents.CancelMessageResponse} returns this
 */
proto.emery.agents.CancelMessageResponse.prototype.setSuccess = function(value) {
  return jspb.Message.setProto3BooleanField(this, 1, value);
};


/**
 * optional string message = 2;
 * @return {string}
 */
proto.emery.agents.CancelMessageResponse.prototype.getMessage = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.CancelMessageResponse} returns this
 */
proto.emery.agents.CancelMessageResponse.prototype.setMessage = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.emery.agents.ChatContext.prototype.toObject = function(opt_includeInstance) {
  return proto.emery.agents.ChatContext.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.emery.agents.ChatContext} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.ChatContext.toObject = function(includeInstance, msg) {
  var f, obj = {
    domainType: jspb.Message.getFieldWithDefault(msg, 1, ""),
    domainId: jspb.Message.getFieldWithDefault(msg, 2, 0)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.emery.agents.ChatContext}
 */
proto.emery.agents.ChatContext.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.emery.agents.ChatContext;
  return proto.emery.agents.ChatContext.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.emery.agents.ChatContext} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.emery.agents.ChatContext}
 */
proto.emery.agents.ChatContext.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setDomainType(value);
      break;
    case 2:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setDomainId(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.emery.agents.ChatContext.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.emery.agents.ChatContext.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.emery.agents.ChatContext} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.emery.agents.ChatContext.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getDomainType();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getDomainId();
  if (f !== 0) {
    writer.writeInt32(
      2,
      f
    );
  }
};


/**
 * optional string domain_type = 1;
 * @return {string}
 */
proto.emery.agents.ChatContext.prototype.getDomainType = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.emery.agents.ChatContext} returns this
 */
proto.emery.agents.ChatContext.prototype.setDomainType = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional int32 domain_id = 2;
 * @return {number}
 */
proto.emery.agents.ChatContext.prototype.getDomainId = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 2, 0));
};


/**
 * @param {number} value
 * @return {!proto.emery.agents.ChatContext} returns this
 */
proto.emery.agents.ChatContext.prototype.setDomainId = function(value) {
  return jspb.Message.setProto3IntField(this, 2, value);
};


/**
 * @enum {number}
 */
proto.emery.agents.TaskStatus = {
  TASK_PENDING: 0,
  TASK_IN_PROGRESS: 1,
  TASK_COMPLETED: 2,
  TASK_FAILED: 3,
  TASK_CANCELLED: 4,
  TASK_TIMEOUT: 5
};

/**
 * @enum {number}
 */
proto.emery.agents.WorkerStatus = {
  WORKER_HEALTHY: 0,
  WORKER_BUSY: 1,
  WORKER_DEGRADED: 2,
  WORKER_UNHEALTHY: 3,
  WORKER_SHUTTING_DOWN: 4
};

/**
 * @enum {number}
 */
proto.emery.agents.StepType = {
  STEP_PLANNING: 0,
  STEP_ACTION: 1,
  STEP_REASONING: 2,
  STEP_FINAL: 3
};

goog.object.extend(exports, proto.emery.agents);
