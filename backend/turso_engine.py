import libsql_client
from typing import Any, List, Optional, Sequence, Tuple, Union

class TursoCursor:
    def __init__(self, client: libsql_client.Client):
        self.client = client
        self.description: Optional[List[Tuple[str, None, None, None, None, None, None]]] = None
        self.rowcount: int = -1
        self.lastrowid: Optional[int] = None
        self._rows: List[Any] = []
        self._idx: int = 0
        self.arraysize: int = 1

    def execute(self, sql: str, params: Optional[Union[Sequence[Any], dict]] = None):
        # Clean params for libsql_client
        clean_params = []
        if params is not None:
            if isinstance(params, tuple):
                clean_params = list(params)
            elif isinstance(params, list):
                clean_params = params
            elif isinstance(params, dict):
                clean_params = params
            else:
                clean_params = list(params)
        
        try:
            rs = self.client.execute(sql, clean_params)
            if rs.columns:
                self.description = [(c, None, None, None, None, None, None) for c in rs.columns]
                self._rows = list(rs.rows)
                self._idx = 0
                self.rowcount = len(self._rows)
            else:
                self.description = None
                self._rows = []
                self._idx = 0
                self.rowcount = rs.rows_affected if rs.rows_affected is not None else 0
            self.lastrowid = rs.last_insert_rowid
        except Exception as e:
            # Re-raise for SQLAlchemy to handle
            raise e
        return self

    def executemany(self, sql: str, seq_of_params: Sequence[Any]):
        count = 0
        for p in seq_of_params:
            self.execute(sql, p)
            if self.rowcount > 0:
                count += self.rowcount
        self.rowcount = count
        return self

    def fetchone(self):
        if self._idx < len(self._rows):
            row = self._rows[self._idx]
            self._idx += 1
            return row
        return None

    def fetchmany(self, size: Optional[int] = None):
        if size is None:
            size = self.arraysize
        end = min(self._idx + size, len(self._rows))
        rows = self._rows[self._idx:end]
        self._idx = end
        return rows

    def fetchall(self):
        rows = self._rows[self._idx:]
        self._idx = len(self._rows)
        return rows

    def close(self):
        self._rows = []
        self._idx = 0

class TursoConnection:
    def __init__(self, url: str, token: str):
        self.client = libsql_client.create_client_sync(url, auth_token=token)
        self.isolation_level = None
        self.autocommit = True
        self.in_transaction = False

    def cursor(self):
        return TursoCursor(self.client)

    def commit(self):
        pass

    def rollback(self):
        pass

    def close(self):
        self.client.close()

    def create_function(self, *args, **kwargs):
        pass

    def create_collation(self, *args, **kwargs):
        pass
