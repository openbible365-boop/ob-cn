from pydantic import BaseModel
from typing import Literal

class CreateCheckoutSessionRequest(BaseModel):
    plan_type: Literal["basic", "pro", "supporter"]
    period: Literal["monthly", "once"]
