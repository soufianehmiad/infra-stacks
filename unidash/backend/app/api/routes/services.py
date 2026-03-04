"""
Services API routes.

Handles service discovery, status, and control.
"""
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ...core.dependencies import CurrentUser, CurrentAdminUser, get_db
from ...models.service import ServiceList, ServiceResponse, ServiceActionRequest, ServiceActionResponse
from ...services import docker_discovery

router = APIRouter(prefix="/services", tags=["services"])


@router.get("", response_model=ServiceList)
async def list_services(
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
):
    """
    List all discovered services from Docker.

    Returns services with their status, health, and metrics.
    Requires authentication.

    Args:
        current_user: Current authenticated user
        skip: Number of records to skip (pagination)
        limit: Maximum number of records to return

    Returns:
        ServiceList with discovered services
    """
    # Discover services from Docker
    services = docker_discovery.discover_services()

    # Apply pagination
    total = len(services)
    paginated_services = services[skip:skip + limit]

    return ServiceList(
        services=paginated_services,
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get("/{service_id}", response_model=ServiceResponse)
async def get_service(
    service_id: str,
    current_user: CurrentUser,
):
    """
    Get a specific service by ID.

    Args:
        service_id: Container short ID
        current_user: Current authenticated user

    Returns:
        ServiceResponse with service details

    Raises:
        HTTPException: If service not found
    """
    service = docker_discovery.get_service_by_id(service_id)

    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Service {service_id} not found",
        )

    return service


@router.post("/{service_id}/action", response_model=ServiceActionResponse)
async def control_service(
    service_id: str,
    action: ServiceActionRequest,
    current_admin: CurrentAdminUser,
):
    """
    Control service (start, stop, restart).

    Requires admin privileges for safety.

    Args:
        service_id: Container short ID
        action: Action to perform
        current_admin: Current authenticated admin user

    Returns:
        ServiceActionResponse with result

    Raises:
        HTTPException: If service not found or action fails
    """
    # Validate action
    valid_actions = ["start", "stop", "restart"]
    if action.action not in valid_actions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid action. Must be one of: {', '.join(valid_actions)}",
        )

    # Check if service exists
    service = docker_discovery.get_service_by_id(service_id)
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Service {service_id} not found",
        )

    # Perform action
    success = docker_discovery.control_service(service_id, action.action)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to {action.action} service {service_id}",
        )

    # Get new status
    updated_service = docker_discovery.get_service_by_id(service_id)
    new_status = updated_service.status if updated_service else "unknown"

    return ServiceActionResponse(
        success=True,
        message=f"Service {service.name} {action.action} command executed successfully",
        service_id=service_id,
        new_status=new_status,
    )
