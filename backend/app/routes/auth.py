import uuid
import secrets
import string
from datetime import datetime, timedelta

from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token,
    jwt_required,
    get_jwt_identity,
)

from app import db
from app.models import User

auth_bp = Blueprint("auth", __name__)


def admin_required(fn):
    from functools import wraps

    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        user = User.query.get(int(get_jwt_identity()))
        if not user or user.role != "admin":
            return jsonify({"error": "Admin access required"}), 403
        return fn(*args, **kwargs)

    return wrapper


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    user = User.query.filter_by(email=data.get("email")).first()
    if not user or not user.check_password(data.get("password", "")):
        return jsonify({"error": "Invalid email or password"}), 401

    token = create_access_token(identity=str(user.id))
    return jsonify({"access_token": token, "user": user.to_dict()})


@auth_bp.route("/register", methods=["POST"])
@admin_required
def register():
    data = request.get_json()
    if User.query.filter_by(email=data.get("email")).first():
        return jsonify({"error": "Email already exists"}), 400

    user = User(
        email=data["email"],
        name=data["name"],
        role=data.get("role", "admin"),
    )
    user.set_password(data["password"])
    db.session.add(user)
    db.session.commit()
    return jsonify(user.to_dict()), 201


@auth_bp.route("/forgot-password", methods=["POST"])
def forgot_password():
    data = request.get_json()
    user = User.query.filter_by(email=data.get("email")).first()
    if not user:
        return jsonify({"message": "If the email exists, a reset link has been sent"}), 200

    user.reset_token = str(uuid.uuid4())
    user.reset_token_expires = datetime.utcnow() + timedelta(hours=1)
    db.session.commit()
    return jsonify({
        "message": "Reset token generated",
        "reset_token": user.reset_token,
    })


@auth_bp.route("/reset-password", methods=["POST"])
def reset_password():
    data = request.get_json()
    token = data.get("token")
    new_password = data.get("new_password")
    if not token or not new_password:
        return jsonify({"error": "Token and new_password are required"}), 400

    user = User.query.filter_by(reset_token=token).first()
    if not user or not user.reset_token_expires or user.reset_token_expires < datetime.utcnow():
        return jsonify({"error": "Invalid or expired token"}), 400

    user.set_password(new_password)
    user.reset_token = None
    user.reset_token_expires = None
    db.session.commit()
    return jsonify({"message": "Password updated successfully"})


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    user = User.query.get(int(get_jwt_identity()))
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify(user.to_dict())


@auth_bp.route("/users", methods=["GET"])
@admin_required
def list_users():
    users = User.query.all()
    return jsonify([u.to_dict() for u in users])


@auth_bp.route("/users/<int:id>", methods=["PUT"])
@admin_required
def update_user(id):
    user = User.query.get_or_404(id)
    data = request.get_json()
    for field in ("name", "role", "email", "is_active", "employee_id"):
        if field in data:
            setattr(user, field, data[field])
    if "password" in data:
        user.set_password(data["password"])
    db.session.commit()
    return jsonify(user.to_dict())


@auth_bp.route("/users/<int:id>", methods=["DELETE"])
@admin_required
def delete_user(id):
    user = User.query.get_or_404(id)
    db.session.delete(user)
    db.session.commit()
    return jsonify({"message": "User deleted"})


@auth_bp.route("/invite", methods=["POST"])
@admin_required
def invite_user():
    data = request.get_json()
    if User.query.filter_by(email=data.get("email")).first():
        return jsonify({"error": "Email already exists"}), 400

    random_password = "".join(
        secrets.choice(string.ascii_letters + string.digits) for _ in range(12)
    )
    user = User(
        email=data["email"],
        name=data["name"],
        role=data.get("role", "admin"),
    )
    user.set_password(random_password)
    db.session.add(user)
    db.session.commit()
    return jsonify({
        "user": user.to_dict(),
        "temporary_password": random_password,
    }), 201
