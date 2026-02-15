import enum

class Gender(str, enum.Enum):
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"
    UNKNOWN = "unknown"

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    EDITOR = "editor"
    VIEWER = "viewer"

class RelationshipType(str, enum.Enum):
    PARENT_CHILD = "parent_child"
    SPOUSE = "spouse"

class MediaType(str, enum.Enum):
    PHOTO = "photo"
    DOCUMENT = "document"
    VIDEO = "video"
    AUDIO = "audio"

class MediaStatus(str, enum.Enum):
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"

class NameType(str, enum.Enum):
    MAIDEN = "maiden"
    MARRIED = "married"
    NICKNAME = "nickname"
    ALIAS = "alias"
    BIRTH = "birth"
    OTHER = "other"
