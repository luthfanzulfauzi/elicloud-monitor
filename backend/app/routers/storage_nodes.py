from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models.storage_node import StorageNode
from ..schemas.storage_node import StorageNodeCreate, StorageNodeUpdate, StorageNodeOut

router = APIRouter(prefix="/storage-nodes", tags=["storage-nodes"])


@router.get("", response_model=list[StorageNodeOut])
async def list_storage_nodes(db: AsyncSession = Depends(get_db)):
    nodes = (await db.execute(
        select(StorageNode).order_by(StorageNode.hostname)
    )).scalars().all()
    return nodes


@router.post("", response_model=StorageNodeOut, status_code=status.HTTP_201_CREATED)
async def create_storage_node(body: StorageNodeCreate, db: AsyncSession = Depends(get_db)):
    existing = (await db.execute(
        select(StorageNode).where(StorageNode.hostname == body.hostname)
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Hostname already exists")
    node = StorageNode(**body.model_dump())
    db.add(node)
    await db.commit()
    await db.refresh(node)
    return node


@router.get("/{node_id}", response_model=StorageNodeOut)
async def get_storage_node(node_id: str, db: AsyncSession = Depends(get_db)):
    node = (await db.execute(
        select(StorageNode).where(StorageNode.id == node_id)
    )).scalar_one_or_none()
    if not node:
        raise HTTPException(status_code=404, detail="Storage node not found")
    return node


@router.put("/{node_id}", response_model=StorageNodeOut)
async def update_storage_node(node_id: str, body: StorageNodeUpdate, db: AsyncSession = Depends(get_db)):
    node = (await db.execute(
        select(StorageNode).where(StorageNode.id == node_id)
    )).scalar_one_or_none()
    if not node:
        raise HTTPException(status_code=404, detail="Storage node not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(node, field, value)
    db.add(node)
    await db.commit()
    await db.refresh(node)
    return node


@router.delete("/{node_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_storage_node(node_id: str, db: AsyncSession = Depends(get_db)):
    node = (await db.execute(
        select(StorageNode).where(StorageNode.id == node_id)
    )).scalar_one_or_none()
    if not node:
        raise HTTPException(status_code=404, detail="Storage node not found")
    await db.delete(node)
    await db.commit()
