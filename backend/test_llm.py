import traceback
from agents.planner import run_planner
try:
    print(run_planner("demo-metformin-001", "org1", "org2", [{"severity":"High", "category":"Test", "description":"gap"}]))
except Exception as e:
    traceback.print_exc()
