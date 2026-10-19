from sqlalchemy import Column, Integer, String, Text
from backend.core.database import Base

class Version(Base):
    """
    Bible Version Model
    """
    __tablename__ = "versions"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(20), unique=True, index=True, nullable=False) # cuv, kjv, niv
    name = Column(String(100), nullable=False)
    language = Column(String(20), nullable=False) # zh, en
    description = Column(Text, nullable=True)
