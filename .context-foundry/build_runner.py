
import sys
import json
from pathlib import Path

# Add context-foundry to path (forward slashes for Windows compatibility)
sys.path.insert(0, '/Users/name/homelab/context-foundry')

from tools.mcp_utils.autonomous_build import execute_build_with_phase_spawning

# Load task config from JSON file
config_file = Path(__file__).parent / "task_config.json"
with open(config_file) as f:
    task_config = json.load(f)

# Execute build with phase spawning
result = execute_build_with_phase_spawning(
    task=task_config["task"],
    working_directory=Path(task_config["working_directory"]),
    task_config=task_config,
    enable_test_loop=task_config["enable_test_loop"],
    max_test_iterations=task_config["max_test_iterations"],
    flowise_mode=task_config["flowise_flow"],
    project_type=task_config["project_type"],
    incremental=task_config["incremental"]
)

print(json.dumps(result))
